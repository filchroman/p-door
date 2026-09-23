import type { Action, PlayerId } from '@vakhta/engine';
import { LocalHost, type ActResult, type HostClock } from '@vakhta/host';
import type { MatchSettings, Me, RoomSeat, RoomState, RoomStatus, SeatInfo, ServerErrorCode, ServerMessage } from '@vakhta/protocol';

/** Имена и аватарки ботов, которыми добиваются пустые места. */
export const BOT_NAMES = ['Боря', 'Галя', 'Петрович', 'Люся', 'Фёдор'];
export const BOT_AVATARS = ['🐻', '🦊', '🐺', '🐱', '🦉'];
/** Столько живёт место отключившегося: вернулся — играет дальше, нет — техническое поражение (спека §6). */
export const HOLD_SEAT_MS = 5 * 60_000;
/** Без таймера хода за пропавшего начинает ходить автоход через минуту, чтобы стол не ждал. */
export const AWAY_AFTER_MS = 60_000;

export interface Member extends Me {
  online: boolean;
  lastSeen: number;
}

export type RoomEvent = { type: 'room' } | { type: 'game' } | { type: 'left'; id: PlayerId };

/**
 * Одна комната: участники, настройки, лобби и партии. Судья — `LocalHost` из пакета `@vakhta/host`,
 * тот же, что играет локально в браузере; комната только рассаживает людей и ботов, следит за
 * связью и раздаёт каждому его срез (`viewFor`) — чужих карт клиенту не уходит.
 */
export class Room {
  readonly code: string;
  hostId: PlayerId;
  status: RoomStatus = 'lobby';
  settings: MatchSettings;
  playerCount: number;
  fillBots = true;
  readonly members = new Map<PlayerId, Member>();
  game: LocalHost | null = null;
  private seats: SeatInfo[] = [];
  private readonly listeners = new Set<(event: RoomEvent) => void>();
  private unsubscribeGame: (() => void) | null = null;
  private readonly awayTimers = new Map<PlayerId, unknown>();
  private readonly dropTimers = new Map<PlayerId, unknown>();

  constructor(
    code: string,
    creator: Me,
    settings: MatchSettings,
    playerCount: number,
    private readonly clock: HostClock,
    private readonly random: () => number = Math.random,
  ) {
    this.code = code;
    this.hostId = creator.id;
    this.settings = settings;
    this.playerCount = playerCount;
    this.members.set(creator.id, { ...creator, online: true, lastSeen: clock.now() });
  }

  subscribe(listener: (event: RoomEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ——— участники ———

  join(me: Me): ServerErrorCode | null {
    const existing = this.members.get(me.id);
    if (existing) {
      this.setOnline(me.id, true);
      existing.name = me.name;
      existing.avatar = me.avatar;
      this.emit({ type: 'room' });
      return null;
    }
    if (this.status === 'closed') return 'no_room';
    if (this.humans().length >= this.playerCount && this.status === 'lobby') return 'room_full';
    this.members.set(me.id, { ...me, online: true, lastSeen: this.clock.now() });
    this.emit({ type: 'room' });
    return null;
  }

  leave(id: PlayerId): void {
    if (!this.members.has(id)) return;
    this.cancelHold(id);
    // Ушёл посреди партии — это техническое поражение (спека §2.4): партия кончается для всех.
    if (this.status === 'playing' && this.game && this.isSeated(id)) this.game.act(id, { type: 'surrender' });
    this.members.delete(id);
    if (this.hostId === id) this.hostId = [...this.members.keys()][0] ?? '';
    this.emit({ type: 'left', id });
    this.emit({ type: 'room' });
  }

  /** Связь пропала или вернулась: место держится HOLD_SEAT_MS, автоход подхватывает через AWAY_AFTER_MS. */
  setOnline(id: PlayerId, online: boolean): void {
    const member = this.members.get(id);
    if (!member) return;
    member.online = online;
    member.lastSeen = this.clock.now();
    this.cancelHold(id);
    if (online) {
      this.game?.setAway(id, false);
    } else {
      if (this.status === 'playing' && this.settings.turnSeconds === 0) {
        this.awayTimers.set(id, this.clock.setTimeout(() => this.game?.setAway(id, true), AWAY_AFTER_MS));
      }
      this.dropTimers.set(id, this.clock.setTimeout(() => this.leave(id), HOLD_SEAT_MS));
    }
    this.emit({ type: 'room' });
  }

  isEmpty(): boolean {
    return this.members.size === 0;
  }

  // ——— лобби ———

  configure(byId: PlayerId, settings: MatchSettings, playerCount: number): ServerErrorCode | null {
    if (byId !== this.hostId) return 'not_host';
    if (this.status === 'playing') return 'already_playing';
    this.settings = settings;
    this.playerCount = Math.max(playerCount, this.humans().length);
    this.emit({ type: 'room' });
    return null;
  }

  setFillBots(byId: PlayerId, on: boolean): ServerErrorCode | null {
    if (byId !== this.hostId) return 'not_host';
    this.fillBots = on;
    this.emit({ type: 'room' });
    return null;
  }

  start(byId: PlayerId): ServerErrorCode | null {
    if (byId !== this.hostId) return 'not_host';
    if (this.status === 'playing') return 'already_playing';
    const humans = this.humans().slice(0, this.playerCount);
    const seats: SeatInfo[] = humans.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, isBot: false }));
    if (this.fillBots) {
      for (let i = 0; seats.length < this.playerCount && i < BOT_NAMES.length; i++) {
        seats.push({ id: `bot${i + 1}`, name: BOT_NAMES[i], avatar: BOT_AVATARS[i], isBot: true });
      }
    }
    if (seats.length < 2) return 'too_few_players';
    this.disposeGame();
    const game = new LocalHost({ seats, settings: this.settings, clock: this.clock, random: this.random });
    this.unsubscribeGame = game.subscribe(() => this.onGameChange());
    this.game = game;
    this.seats = seats;
    this.status = 'playing';
    game.start();
    if (game.getStatus() === 'crashed') {
      this.disposeGame();
      this.status = 'lobby';
      return 'not_enough_cards';
    }
    for (const m of this.members.values()) if (!m.online) game.setAway(m.id, true);
    this.emit({ type: 'room' });
    return null;
  }

  next(byId: PlayerId): ServerErrorCode | null {
    if (byId !== this.hostId) return 'not_host';
    if (!this.game) return 'wrong_phase';
    return this.game.nextGame() ? null : 'not_enough_cards';
  }

  /** Закрыть вечер: итоги сессии всем, комната возвращается в лобби. */
  close(byId: PlayerId): ServerErrorCode | null {
    if (byId !== this.hostId) return 'not_host';
    if (!this.game) return 'wrong_phase';
    this.game.endSession();
    this.status = 'lobby';
    this.emit({ type: 'room' });
    return null;
  }

  act(id: PlayerId, action: Action): ActResult {
    if (!this.game || !this.isSeated(id)) return { ok: false, error: 'wrong_phase' };
    return this.game.act(id, action);
  }

  // ——— срезы ———

  state(): RoomState {
    const seats: RoomSeat[] = [...this.members.values()].map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, isBot: false, online: m.online }));
    for (const seat of this.seats) if (seat.isBot && this.status === 'playing') seats.push({ ...seat, online: true });
    const summary = this.game?.getSummary();
    return {
      code: this.code,
      hostId: this.hostId,
      seats,
      playerCount: this.playerCount,
      settings: this.settings,
      fillBots: this.fillBots,
      status: this.status,
      losses: summary?.losses ?? {},
      gameNumber: summary?.gameNumber ?? 0,
    };
  }

  /** Срез партии для участника: игрок видит свою руку, зритель — стол без руки. */
  viewMessage(id: PlayerId): ServerMessage | null {
    if (!this.game) return null;
    const view = this.game.viewFor(id);
    if (!view) return null;
    return {
      type: 'game:view',
      view,
      version: this.game.getChangeSeq(),
      events: this.game.getLastEvents(),
      session: this.game.getSummary(),
      players: this.game.getSeats(),
      deadlines: this.game.getDeadlines(),
    };
  }

  dispose(): void {
    for (const id of [...this.awayTimers.keys(), ...this.dropTimers.keys()]) this.cancelHold(id);
    this.disposeGame();
    this.listeners.clear();
  }

  // ——— внутреннее ———

  private humans(): Member[] {
    return [...this.members.values()];
  }

  private isSeated(id: PlayerId): boolean {
    return this.seats.some((seat) => seat.id === id);
  }

  private onGameChange(): void {
    const status = this.game?.getStatus();
    if (status === 'sessionOver') this.status = 'lobby';
    this.emit({ type: 'game' });
  }

  private disposeGame(): void {
    this.unsubscribeGame?.();
    this.unsubscribeGame = null;
    this.game?.dispose();
    this.game = null;
    this.seats = [];
  }

  private cancelHold(id: PlayerId): void {
    const away = this.awayTimers.get(id);
    if (away !== undefined) this.clock.clearTimeout(away);
    this.awayTimers.delete(id);
    const drop = this.dropTimers.get(id);
    if (drop !== undefined) this.clock.clearTimeout(drop);
    this.dropTimers.delete(id);
  }

  private emit(event: RoomEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
