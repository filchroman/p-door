import {
  apply,
  autoAction,
  canDeal,
  createGame,
  isWatchOpen,
  newSession,
  nextDeadline,
  pendingPlayers,
  prykupSize,
  recordResult,
  setupNextGame,
  vakhterVechora,
  viewFor,
  type Action,
  type ApplyResult,
  type Card,
  type DeckSize,
  type ErrorCode,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PlayerView,
  type SessionState,
} from '@vakhta/engine';
import { botAction, botVakhtaDelay } from './bots/botAction';
import type { BotSpeed, LogEntry } from './debug';
import type { Deadlines, MatchSettings, SeatInfo, SessionStatus, SessionSummary } from '@vakhta/protocol';
import { cryptoShuffledDeck } from './shuffle';
import { BOT_DELAY_MAX_MS, BOT_DELAY_MIN_MS, PENALTY_MS, TICK_SLACK_MS, type HostClock, type TimerHandle } from './types';

export interface HostOptions {
  seats: SeatInfo[];
  settings: MatchSettings;
  clock?: HostClock;
  random?: () => number;
  shuffleDeck?: (deckSize: DeckSize) => Card[];
  botSpeed?: BotSpeed;
  /** Только для тестов: начать сразу с этого состояния вместо раздачи. */
  initialState?: GameState;
}

export type ActResult = { ok: true } | { ok: false; error: ErrorCode };

export const realClock: HostClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

const MAX_AUTO_STEPS = 64;
const LOG_LIMIT = 500;
/**
 * Шаги, из которых состоит ход. Ход фазы 1 — цикл (спека §2.2): «+1» продолжает его, и таких шагов
 * в одном ходу может быть много. Время хода отмеряется на шаг, а не на весь цикл, поэтому каждый
 * такой шаг ходящего перезапускает таймер. Вызов Вахты соперником, штраф и `tick` — не шаги хода.
 */
const TURN_STEPS = new Set<Action['type']>(['draw', 'placeDrawn', 'moveOwnTop', 'play', 'take']);
/** Столько отклонённых шагов подряд — и партию уже не расшевелить: показываем экран сбоя. */
const MAX_STUCK_STEPS = 5;

export class LocalHost {
  private readonly seats: SeatInfo[];
  private readonly settings: MatchSettings;
  private readonly clock: HostClock;
  private readonly random: () => number;
  private readonly shuffleDeck: (deckSize: DeckSize) => Card[];
  private readonly initialState: GameState | undefined;
  private readonly listeners = new Set<() => void>();
  private state: GameState | null = null;
  private session: SessionState = newSession();
  private gameNumber = 0;
  private status: SessionStatus = 'playing';
  private lastEvents: GameEvent[] = [];
  private changeSeq = 0;
  private actionCount = 0;
  /** Сквозной номер шага хода: растёт на каждый шаг ходящего и тем перезапускает таймер хода. */
  private turnSteps = 0;
  private log: LogEntry[] = [];
  private unexpectedErrorCount = 0;
  /** Отклонённых автоматических шагов подряд; любое применённое действие обнуляет. */
  private stuckSteps = 0;
  private botSpeed: BotSpeed;
  /** Места, за которыми сидят люди; остальные — боты. */
  private humans: Set<PlayerId>;
  private autopilot = false;
  /** Люди, которые сейчас не на связи: за них ходит автоход, пока они не вернутся. */
  private away = new Set<PlayerId>();
  private botTimers = new Map<PlayerId, TimerHandle>();
  /** Ключ — таймер; значение — за какого игрока и по какому окну был запланирован вызов. */
  private vakhtaTimers = new Map<TimerHandle, { playerId: PlayerId; watchId: number }>();
  private seenWatchId = 0;
  private tickTimer: TimerHandle | null = null;
  private tickAt: number | null = null;
  private turnTimer: TimerHandle | null = null;
  private turnKey: string | null = null;
  private turnEndsAt: number | null = null;
  private penaltyTimer: TimerHandle | null = null;
  private penaltyEndsAt: number | null = null;

  constructor(options: HostOptions) {
    this.seats = options.seats.map((seat) => ({ ...seat }));
    this.settings = options.settings;
    this.clock = options.clock ?? realClock;
    this.random = options.random ?? Math.random;
    this.shuffleDeck = options.shuffleDeck ?? cryptoShuffledDeck;
    this.botSpeed = options.botSpeed ?? 1;
    this.initialState = options.initialState;
    this.humans = new Set(options.seats.filter((seat) => !seat.isBot).map((seat) => seat.id));
  }

  // ——— публичный API ———

  start(): void {
    if (this.initialState) {
      this.state = structuredClone(this.initialState);
      this.gameNumber = 1;
      this.changeSeq++;
      this.afterChange();
      return;
    }
    this.newGame();
  }

  act(playerId: PlayerId, action: Action): ActResult {
    return this.applyAction(playerId, action);
  }

  nextGame(): boolean {
    if (this.status !== 'gameOver' || !this.canDealNext()) return false;
    this.newGame();
    return this.getStatus() === 'playing';
  }

  endSession(): void {
    if (this.status === 'crashed') return;
    this.clearAllTimers();
    this.status = 'sessionOver';
    this.emit();
  }

  dispose(): void {
    this.clearAllTimers();
    this.listeners.clear();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): GameState | null {
    return this.state;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getSeats(): SeatInfo[] {
    return this.seats.map((seat) => ({ ...seat, isBot: !this.humans.has(seat.id) }));
  }

  getLastEvents(): GameEvent[] {
    return this.lastEvents;
  }

  getChangeSeq(): number {
    return this.changeSeq;
  }

  getLog(): LogEntry[] {
    return [...this.log];
  }

  /** Число отклонённых движком действий (кроме безвредного `nothing_to_call`) за всю сессию — лог обрезается, счётчик нет. */
  getErrorCount(): number {
    return this.unexpectedErrorCount;
  }

  getDeadlines(): Deadlines {
    return {
      turnEndsAt: this.turnEndsAt,
      turnTotalMs: this.turnEndsAt === null ? null : this.settings.turnSeconds * 1000,
      penaltyEndsAt: this.penaltyEndsAt,
      penaltyTotalMs: this.penaltyEndsAt === null ? null : PENALTY_MS,
    };
  }

  getSummary(): SessionSummary {
    return {
      gameNumber: this.gameNumber,
      losses: { ...this.session.losses },
      vakhterId: vakhterVechora(this.session),
      status: this.status,
      canContinue: this.canDealNext(),
    };
  }

  getHands(): Record<PlayerId, Card[]> {
    return Object.fromEntries((this.state?.players ?? []).map((p) => [p.id, [...p.hand]]));
  }

  viewFor(playerId: PlayerId): PlayerView | null {
    return this.state ? viewFor(this.state, playerId, this.clock.now()) : null;
  }

  isBotControlled(id: PlayerId): boolean {
    return !this.humans.has(id) || this.autopilot || this.away.has(id);
  }

  /** Отладка локальной игры: единственный человек пересаживается на место `id`. */
  setHumanSeat(id: PlayerId | null): void {
    this.humans = new Set(id === null ? [] : [id]);
    // Место `id` теперь человек: снимаем уже запланированные вызовы Вахты ботом за него.
    this.cancelVakhtaTimersFor(id);
    if (this.state && this.status === 'playing') this.reschedule();
    this.emit();
  }

  setAutopilot(on: boolean): void {
    this.autopilot = on;
    // Автопилот выключен — места людей снова под их контролем, отменяем висящие вызовы бота за них.
    if (!on) for (const id of this.humans) this.cancelVakhtaTimersFor(id);
    if (this.state && this.status === 'playing') this.reschedule();
  }

  /**
   * Сервер: человек пропал со связи — за него ходит автоход, чтобы стол не ждал; вернулся — место
   * снова его. Плашка «переподключается» — забота комнаты, хосту важна только управляемость.
   */
  setAway(id: PlayerId, on: boolean): void {
    if (on) this.away.add(id);
    else {
      this.away.delete(id);
      this.cancelVakhtaTimersFor(id);
    }
    if (this.state && this.status === 'playing') this.reschedule();
  }

  isAway(id: PlayerId): boolean {
    return this.away.has(id);
  }

  setBotSpeed(speed: BotSpeed): void {
    this.botSpeed = speed;
  }

  // ——— партия ———

  private canDealNext(): boolean {
    return canDeal(this.settings.deckSize, this.seats.map((seat) => prykupSize(this.session, seat.id)));
  }

  private newGame(): void {
    this.clearAllTimers();
    let state: GameState;
    try {
      const seed = Math.floor(this.random() * 0x1_0000_0000);
      const ids = this.seats.map((seat) => seat.id);
      const setup = setupNextGame(this.session, ids, this.settings.deckSize, seed, this.settings.stallRule);
      state = createGame({ ...setup, deck: this.shuffleDeck(this.settings.deckSize) });
    } catch (error) {
      this.crash(error);
      return;
    }
    this.state = state;
    this.gameNumber++;
    this.status = 'playing';
    this.lastEvents = [];
    this.seenWatchId = 0;
    this.changeSeq++;
    this.pushLog({ at: this.clock.now(), playerId: null, action: null, events: [], note: `game ${this.gameNumber}` });
    this.afterChange();
  }

  private applyAction(playerId: PlayerId, action: Action): ActResult {
    if (!this.state || this.status !== 'playing') return { ok: false, error: 'wrong_phase' };
    const now = this.clock.now();
    const turnBefore = this.state.turn;
    let result: ApplyResult;
    try {
      result = apply(this.state, playerId, action, now);
    } catch (error) {
      this.crash(error);
      return { ok: false, error: 'wrong_phase' };
    }
    const actor = action.type === 'tick' ? null : playerId;
    if (!result.ok) {
      this.pushLog({ at: now, playerId: actor, action, events: [], error: result.error });
      return { ok: false, error: result.error };
    }
    this.state = result.state;
    this.lastEvents = result.events;
    this.stuckSteps = 0;
    this.changeSeq++;
    if (action.type !== 'tick') this.actionCount++;
    if (playerId === turnBefore && TURN_STEPS.has(action.type)) this.turnSteps++;
    this.pushLog({ at: now, playerId: actor, action, events: result.events });
    this.afterChange();
    return { ok: true };
  }

  private afterChange(): void {
    const state = this.state!;
    if (state.phase === 'over') {
      if (this.status === 'playing') {
        this.session = recordResult(this.session, state.result!);
        this.status = 'gameOver';
      }
      this.clearAllTimers();
    } else {
      this.reschedule();
    }
    this.emit();
  }

  private crash(error: unknown): void {
    this.clearAllTimers();
    this.status = 'crashed';
    const text = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    this.pushLog({ at: this.clock.now(), playerId: null, action: null, events: [], error: text });
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  private pushLog(entry: LogEntry): void {
    if (entry.error && entry.error !== 'nothing_to_call') this.unexpectedErrorCount++;
    this.log.push(entry);
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
  }

  // ——— таймеры ———

  private later(ms: number, fn: () => void): TimerHandle {
    return this.clock.setTimeout(fn, Math.max(0, ms));
  }

  private cancel(handle: TimerHandle | null): void {
    if (handle !== null) this.clock.clearTimeout(handle);
  }

  private clearAllTimers(): void {
    this.cancel(this.tickTimer);
    this.tickTimer = null;
    this.tickAt = null;
    this.cancel(this.turnTimer);
    this.turnTimer = null;
    this.turnKey = null;
    this.turnEndsAt = null;
    this.cancel(this.penaltyTimer);
    this.penaltyTimer = null;
    this.penaltyEndsAt = null;
    for (const handle of this.botTimers.values()) this.cancel(handle);
    this.botTimers.clear();
    for (const handle of this.vakhtaTimers.keys()) this.cancel(handle);
    this.vakhtaTimers.clear();
  }

  /** Отменяет ещё не сработавшие вызовы Вахты, запланированные ботом за это место. */
  private cancelVakhtaTimersFor(id: PlayerId | null): void {
    if (id === null) return;
    for (const [handle, info] of this.vakhtaTimers) {
      if (info.playerId !== id) continue;
      this.cancel(handle);
      this.vakhtaTimers.delete(handle);
    }
  }

  private reschedule(): void {
    this.scheduleTick();
    this.scheduleTurnTimer();
    this.schedulePenaltyTimer();
    this.scheduleBots();
    this.scheduleVakhtaCalls();
  }

  private scheduleTick(): void {
    const at = nextDeadline(this.state!);
    if (at === this.tickAt && this.tickTimer !== null) return;
    this.cancel(this.tickTimer);
    this.tickTimer = null;
    this.tickAt = at;
    if (at === null) return;
    this.tickTimer = this.later(at - this.clock.now() + TICK_SLACK_MS, () => {
      this.tickTimer = null;
      this.tickAt = null;
      this.applyAction(this.state!.players[0].id, { type: 'tick' });
    });
  }

  private scheduleTurnTimer(): void {
    const state = this.state!;
    const seconds = this.settings.turnSeconds;
    const timed = seconds > 0 && (state.phase === 'phase1' || state.phase === 'phase2');
    // В ключ входит номер шага хода: каждый шаг ходящего — новый ключ, то есть время хода заново.
    const key = timed ? `${this.gameNumber}:${state.phase}:${state.turn}:${this.turnSteps}` : null;
    if (key === this.turnKey) return;
    this.cancel(this.turnTimer);
    this.turnTimer = null;
    this.turnEndsAt = null;
    this.turnKey = key;
    if (key === null) return;
    this.turnEndsAt = this.clock.now() + seconds * 1000;
    this.turnTimer = this.later(seconds * 1000, () => {
      this.turnTimer = null;
      this.turnEndsAt = null;
      this.turnKey = null;
      this.autoPlayTurn();
    });
  }

  /** Автоход за ходящего: в фазе 1 — пока не сменится ход или фаза, в фазе 2 — одно действие. */
  private autoPlayTurn(): void {
    const { phase, turn } = this.state!;
    const startCount = this.actionCount;
    for (let i = 0; i < MAX_AUTO_STEPS; i++) {
      const state = this.state!;
      if (this.status !== 'playing' || state.phase !== phase || state.turn !== turn) return;
      if (phase === 'phase2' && this.actionCount !== startCount) return;
      const action = autoAction(state, turn, this.random);
      if (!action || !this.applyAction(turn, action).ok) {
        this.stuck(`autoPlayTurn ${turn}`);
        return;
      }
    }
  }

  private schedulePenaltyTimer(): void {
    const state = this.state!;
    const owing = state.phase === 'penalty' && state.debts.some((d) => d.count > 0);
    if (!owing) {
      this.cancel(this.penaltyTimer);
      this.penaltyTimer = null;
      this.penaltyEndsAt = null;
      return;
    }
    if (this.penaltyTimer !== null) return;
    this.penaltyEndsAt = this.clock.now() + PENALTY_MS;
    this.penaltyTimer = this.later(PENALTY_MS, () => {
      this.penaltyTimer = null;
      this.penaltyEndsAt = null;
      this.autoPayDebts();
    });
  }

  private autoPayDebts(): void {
    let rejected: PlayerId | null = null;
    for (const id of pendingPlayers(this.state!)) {
      for (let i = 0; i < MAX_AUTO_STEPS; i++) {
        const state = this.state!;
        if (this.status !== 'playing' || state.phase !== 'penalty') return;
        const action = autoAction(state, id, this.random);
        if (!action) break;
        if (!this.applyAction(id, action).ok) {
          rejected = id;
          break;
        }
      }
    }
    if (rejected !== null) this.stuck(`autoPayDebts ${rejected}`);
  }

  private scheduleBots(): void {
    const pending = new Set(pendingPlayers(this.state!).filter((id) => this.isBotControlled(id)));
    for (const [id, handle] of this.botTimers) {
      if (pending.has(id)) continue;
      this.cancel(handle);
      this.botTimers.delete(id);
    }
    for (const id of pending) {
      if (this.botTimers.has(id)) continue;
      const delay = (BOT_DELAY_MIN_MS + this.random() * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS)) / this.botSpeed;
      this.botTimers.set(
        id,
        this.later(delay, () => {
          this.botTimers.delete(id);
          this.botStep(id);
        }),
      );
    }
  }

  private botStep(id: PlayerId): void {
    const state = this.state!;
    if (this.status !== 'playing' || !this.isBotControlled(id) || !pendingPlayers(state).includes(id)) return;
    const action = botAction(state, id, this.random) ?? autoAction(state, id, this.random);
    if (action && this.applyAction(id, action).ok) return;
    const fallback = action ? autoAction(this.state!, id, this.random) : null;
    if (fallback && this.applyAction(id, fallback).ok) return;
    // Шаг бота свой таймер уже снял: без перепланирования партия замерла бы навсегда.
    this.stuck(`botStep ${id}`);
  }

  /**
   * Автоматический шаг не прошёл (и ход бота, и запасной автоход отклонены). Свой таймер такой шаг
   * уже снял, поэтому сначала планируем всё заново — иначе партия замирает без единого события.
   * Если не расшевелить и за MAX_STUCK_STEPS подряд — это уже не осечка: показываем экран сбоя.
   */
  private stuck(what: string): void {
    if (!this.state || this.status !== 'playing') return;
    this.stuckSteps++;
    if (this.stuckSteps >= MAX_STUCK_STEPS) {
      this.crash(new Error(`stuck: ${what} rejected ${this.stuckSteps} times in a row`));
      return;
    }
    this.pushLog({ at: this.clock.now(), playerId: null, action: null, events: [], note: `retry after ${what}` });
    this.reschedule();
  }

  private scheduleVakhtaCalls(): void {
    const state = this.state!;
    for (const watch of state.watches) {
      if (watch.id <= this.seenWatchId) continue;
      for (const p of state.players) {
        if (p.out || !this.isBotControlled(p.id)) continue;
        const delay = botVakhtaDelay(state, p.id, watch.id, this.random);
        if (delay === null) continue;
        const playerId = p.id;
        const watchId = watch.id;
        const handle = this.later(delay / this.botSpeed, () => {
          this.vakhtaTimers.delete(handle);
          this.fireVakhtaCall(playerId, watchId);
        });
        this.vakhtaTimers.set(handle, { playerId, watchId });
      }
      this.seenWatchId = Math.max(this.seenWatchId, watch.id);
    }
  }

  /**
   * Срабатывание отложенного решения бота по конкретному окну Вахты. Место могло за это время
   * перейти к человеку (`setHumanSeat`/`setAutopilot`), а само окно — закрыться (истёк грайс-период,
   * его уже кто-то вызвал, или партия ушла в другую фазу/завершилась) — тогда ничего не делаем.
   */
  private fireVakhtaCall(playerId: PlayerId, watchId: number): void {
    if (!this.state || this.status !== 'playing') return;
    if (!this.isBotControlled(playerId)) return;
    if (this.state.phase !== 'phase1' && this.state.phase !== 'penalty') return;
    const watch = this.state.watches.find((w) => w.id === watchId);
    if (!watch || !isWatchOpen(watch, this.clock.now())) return;
    this.applyAction(playerId, { type: 'callVakhta' });
  }
}
