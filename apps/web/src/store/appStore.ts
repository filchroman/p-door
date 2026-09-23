import { cardToString as cardKeyOf, type Card, type DeckSize, type PlayerId } from '@vakhta/engine';
import { create } from 'zustand';
import { preloadDeck } from '../cards/preload';
import { createLocalMatch, type MatchSetup } from '../client/createLocalMatch';
import type { BotSpeed, LogEntry } from '../client/debug';
import type { AppClient, ClientUpdate, Intent } from '../client/types';
import { NO_FLIGHTS, dealFlights, flightsFor, type Flights } from '../ui/anim/flights';
import { DWELL_MS, STAGGER_MS, flyMs, sweepMs } from '../ui/anim/motion';
import type { Origin } from '../ui/anim/origins';
import { prefersReducedMotion } from '../ui/anim/reducedMotion';
import { VIBRATE_ERROR, vibrate } from '../ui/haptics';
import {
  actingFrom,
  celebrationHoldMs,
  emptyMarks,
  errorText,
  eventToasts,
  keepSelection,
  nextMarks,
  sweptCards,
  trumpRevealUpdate,
  type ActingFx,
  type RecentMarks,
  type Selection,
  type ToastSpec,
  type ToastTone,
} from './derive';
import { exposeView } from './expose';
import { CAPTION_FADE_MS, TRUMP_REVEAL_MS, UpdatePump, captionHoldMs } from './updatePump';

export type Screen = 'home' | 'loading' | 'game';

export interface Toast extends ToastSpec {
  id: number;
}

/**
 * Отбой в полёте: карты ушедшего стола, свой ключ на каждый отбой и сколько им лететь.
 * `landing` — первая фаза (спека §2c.3): закрывающая карта ещё летит из руки и ложится на стол,
 * стол стоит на месте; после паузы `landing` снимается, и стол сметается.
 */
export interface TableSweep {
  seq: number;
  cards: Card[];
  ms: number;
  landing: { key: string; from: Origin | string; ms: number } | null;
  /** Стол ещё стоит (закрывающая карта долетает или лежит паузу) — сметание не началось. */
  waiting: boolean;
}

/** Как игрок сделал ход: перетащил карту сам — второй раз к цели её не везём. */
export interface SendOptions {
  dragged?: boolean;
}

export interface DebugSettings {
  open: boolean;
  showAllHands: boolean;
  botSpeed: BotSpeed;
  autopilot: boolean;
}

export interface AppState {
  screen: Screen;
  client: AppClient | null;
  lastSetup: MatchSetup | null;
  update: ClientUpdate | null;
  marks: RecentMarks;
  selection: Selection;
  toasts: Toast[];
  debug: DebugSettings;
  allHands: Record<PlayerId, Card[]> | null;
  log: LogEntry[];
  /** false — тестовое окружение: срезы показываются сразу, карты не анимируются. */
  motionEnabled: boolean;
  /** Во сколько раз ускорить анимации текущего шага (очередь догоняет состояние). */
  animSpeed: number;
  /** Улетающий в отбой стол: живёт поверх зоны стола свои ms и исчезает целиком. */
  sweep: TableSweep | null;
  /** Идёт праздничный такт: стол с лентой «Вышел!» держится, итоги ещё не открыты. */
  celebrating: boolean;
  /** Кто сейчас действует и что сделал: подсветка рамки и подпись рядом с ней (спека §2c). */
  acting: ActingFx | null;
  /** Откуда какая карта прилетела в этом срезе: перелёт проигрывает приёмник (спека §2c.1). */
  flights: Flights;
  makeClient: (setup: MatchSetup) => AppClient;
  preload: (deckSize: DeckSize) => Promise<void>;
  startMatch(setup: MatchSetup): Promise<void>;
  send(intent: Intent, options?: SendOptions): void;
  select(selection: Selection): void;
  pushToast(text: string, tone?: ToastTone): void;
  dismissToast(id: number): void;
  nextGame(): void;
  endSession(): void;
  goHome(): void;
  restart(): Promise<void>;
  toggleDebug(): void;
  setShowAllHands(on: boolean): void;
  setBotSpeed(speed: BotSpeed): void;
  setAutopilot(on: boolean): void;
  playAs(id: PlayerId): void;
}

const MAX_TOASTS = 4;
let toastSeq = 0;
let detach: (() => void) | null = null;
let celebrateTimer: ReturnType<typeof setTimeout> | null = null;
let sweepTimer: ReturnType<typeof setTimeout> | null = null;
let sweepSeq = 0;
let actTimer: ReturnType<typeof setTimeout> | null = null;
let actSeq = 0;
/** Карта, которую я только что перетащил сам: её перелёт к цели не показываем. */
let draggedKey: string | null = null;
let revealTimer: ReturnType<typeof setTimeout> | null = null;
/** Сколько последний показанный срез просил держать экран (отбой с паузой и т. п.). */
let lastHold = 0;

function stopReveal(): void {
  if (revealTimer !== null) clearTimeout(revealTimer);
  revealTimer = null;
}

/** Какую карту переносит намерение: вытянутую, свою верхнюю или карту из руки. */
function draggedCardKey(intent: Intent, view: NonNullable<AppState['update']>['view']): string | null {
  if (intent.type === 'placeDrawn') return view.drawn ? cardKeyOf(view.drawn) : null;
  if (intent.type === 'moveOwnTop') {
    const top = view.players.find((p) => p.id === view.me)?.stackTop;
    return top ? cardKeyOf(top) : null;
  }
  if (intent.type === 'play') return cardKeyOf(intent.card);
  return null;
}

/** Карта, закрывшая отбой в этом срезе: сыграна и тем же действием ушла со стола. */
function landingKey(update: ClientUpdate): string | null {
  const played = update.events.find((event) => event.type === 'played');
  return played && played.type === 'played' ? cardKeyOf(played.card) : null;
}

function stopActing(): void {
  if (actTimer !== null) clearTimeout(actTimer);
  actTimer = null;
}

function stopCelebration(): void {
  if (celebrateTimer !== null) clearTimeout(celebrateTimer);
  celebrateTimer = null;
}

function stopSweep(): void {
  if (sweepTimer !== null) clearTimeout(sweepTimer);
  sweepTimer = null;
}

export const useAppStore = create<AppState>()((set, get) => {
  const show = (update: ClientUpdate, speed: number): number => {
    const { marks, selection, debug, client, log, sweep, motionEnabled, update: prev } = get();
    const reduced = prefersReducedMotion();
    // Козырь: сначала показ вытянутой последней карты, настоящий срез — после паузы.
    const reveal = motionEnabled && !reduced ? trumpRevealUpdate(prev, update) : null;
    if (reveal) {
      const revealMs = Math.round(TRUMP_REVEAL_MS / Math.max(1, speed));
      showSlice(reveal, speed);
      stopReveal();
      revealTimer = setTimeout(() => {
        revealTimer = null;
        showSlice(update, speed);
      }, revealMs);
      return revealMs + Math.max(0, lastHold);
    }
    return showSlice(update, speed);
  };

  const showSlice = (update: ClientUpdate, speed: number): number => {
    const { marks, selection, debug, client, log, sweep, motionEnabled, update: prev } = get();
    const reduced = prefersReducedMotion();
    // Новая партия — новый стол: ни улетающий отбой прошлой, ни её праздничный такт сюда не тянутся.
    const fresh = !prev || prev.session.gameNumber !== update.session.gameNumber;
    // Стол переживает свой последний срез: иначе экран итогов съедает ленту «Вышел!» и конфетти.
    const hold = motionEnabled && !fresh ? celebrationHoldMs({ prev, next: update, speed, reduced }) : 0;
    // Отбой улетает отдельным слоем: в самой зоне стола всегда ровно карты среза.
    const swept = motionEnabled && !fresh ? sweptCards(prev, update) : [];
    const ms = sweepMs(speed, reduced);
    const dwell = Math.round(DWELL_MS / Math.max(1, speed));
    // Зоны исчезают вместе со срезом (прикуп ушёл в руку, карта — со стола): места карт снимаются
    // с ещё не перерисованного экрана, и это начала перелётов этого хода (спека §2c.1).
    const seq = ++actSeq;
    const flights = !motionEnabled || reduced ? NO_FLIGHTS : fresh ? dealFlights(update, STAGGER_MS) : flightsFor(prev, update, seq);
    // Я перетащил карту сам — она уже у цели, везти её туда второй раз незачем.
    if (draggedKey && actingFrom(update, 0, 0)?.id === update.view.me) {
      delete flights.cards[draggedKey];
      // И появления у приёмника тоже нет: карта уже лежит там, куда её положили.
      flights.settled = { ...flights.settled, [draggedKey]: true };
      draggedKey = null;
    }
    // Закрывающая карта сначала долетает до стола (её место в руке снято до перерисовки),
    // лежит там паузу, и только потом стол сметается — перелёт и сметание не идут вместе (§2c.3).
    const closingKey = swept.length > 0 ? landingKey(update) : null;
    const landing = closingKey && flights.cards[closingKey] ? { key: closingKey, from: flights.cards[closingKey], ms: flyMs(speed) } : null;
    if (landing) delete flights.cards[landing.key];
    // Перетащил закрывающую карту сам — перелёта нет, но пауза перед сметанием остаётся.
    const preMs = landing ? landing.ms + dwell : closingKey ? dwell : 0;
    const captionMs = captionHoldMs(speed);
    const acting = actingFrom(update, seq, captionMs);
    stopCelebration();
    stopActing();
    if (fresh || swept.length > 0) stopSweep();
    set({
      update,
      animSpeed: speed,
      sweep: swept.length > 0 ? { seq: ++sweepSeq, cards: swept, ms, landing, waiting: preMs > 0 } : fresh ? null : sweep,
      celebrating: hold > 0,
      acting,
      flights,
      marks: nextMarks(marks, update),
      selection: keepSelection(selection, update.view),
      allHands: debug.showAllHands ? (client?.debug?.allHands() ?? null) : null,
      // Панель отладки закрыта в подавляющее большинство времени — не читаем журнал на каждом
      // срезе очереди анимаций, только пока он виден (иначе лишняя работа на каждый ход бота).
      log: debug.open ? (client?.debug?.log() ?? log) : log,
    });
    exposeView(update);
    if (hold > 0) {
      celebrateTimer = setTimeout(() => {
        celebrateTimer = null;
        set({ celebrating: false });
      }, hold);
    }
    let sweepHold = 0;
    if (swept.length > 0) {
      const mySeq = sweepSeq;
      const startSweep = () => {
        sweepTimer = setTimeout(() => {
          sweepTimer = null;
          set({ sweep: null });
        }, ms);
      };
      if (preMs > 0) {
        sweepTimer = setTimeout(() => {
          const current = get().sweep;
          if (current?.seq === mySeq) set({ sweep: { ...current, landing: null, waiting: false } });
          startSweep();
        }, preMs);
        sweepHold = preMs + ms;
      } else {
        startSweep();
        sweepHold = ms;
      }
    }
    // Подпись сменяется следующим действием; если его нет — гаснет сама, а не висит до конца партии.
    // Снимается она после угасания: последние CAPTION_FADE_MS плашка растворяется, а не пропадает кадром.
    if (acting && motionEnabled) {
      actTimer = setTimeout(() => {
        actTimer = null;
        set({ acting: null });
      }, captionMs + CAPTION_FADE_MS);
    }
    for (const toast of eventToasts(update)) get().pushToast(toast.text, toast.tone);
    lastHold = Math.max(sweepHold, hold);
    return lastHold;
  };

  const pump = new UpdatePump<ClientUpdate>(show, () => get().motionEnabled);

  const attach = (client: AppClient) => {
    detach?.();
    const offUpdate = client.subscribe((update) => pump.push(update));
    const offError = client.onError((code) => {
      get().pushToast(errorText(code, get().update?.view ?? null), 'error');
      vibrate(VIBRATE_ERROR);
      set({ selection: null });
    });
    detach = () => {
      offUpdate();
      offError();
      pump.clear();
      stopCelebration();
      stopSweep();
      stopActing();
      stopReveal();
      client.dispose();
    };
  };

  return {
    screen: 'home',
    client: null,
    lastSetup: null,
    update: null,
    marks: emptyMarks(0),
    selection: null,
    toasts: [],
    debug: { open: false, showAllHands: false, botSpeed: 1, autopilot: false },
    allHands: null,
    log: [],
    motionEnabled: true,
    animSpeed: 1,
    sweep: null,
    celebrating: false,
    acting: null,
    flights: NO_FLIGHTS,
    makeClient: (setup) => createLocalMatch(setup),
    preload: (deckSize) => preloadDeck(deckSize),

    async startMatch(setup) {
      set({ screen: 'loading', lastSetup: setup });
      await get().preload(setup.settings.deckSize);
      if (get().screen !== 'loading') return;
      const client = get().makeClient(setup);
      attach(client);
      const { debug } = get();
      client.debug?.setBotSpeed(debug.botSpeed);
      client.debug?.setAutopilot(debug.autopilot);
      const update = client.snapshot();
      draggedKey = null;
      set({
        client,
        screen: 'game',
        update,
        animSpeed: 1,
        sweep: null,
        celebrating: false,
        acting: null,
        flights: update && get().motionEnabled && !prefersReducedMotion() ? dealFlights(update, STAGGER_MS) : NO_FLIGHTS,
        marks: emptyMarks(update?.session.gameNumber ?? 0),
        selection: null,
        allHands: debug.showAllHands ? (client.debug?.allHands() ?? null) : null,
        log: client.debug?.log() ?? [],
      });
      exposeView(update);
    },

    send(intent, options) {
      const view = get().update?.view ?? null;
      draggedKey = options?.dragged && view ? draggedCardKey(intent, view) : null;
      set({ selection: null });
      get().client?.send(intent);
    },

    select(selection) {
      set({ selection });
    },

    pushToast(text, tone = 'info') {
      const toast: Toast = { id: ++toastSeq, text, tone };
      set({ toasts: [...get().toasts, toast].slice(-MAX_TOASTS) });
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },

    nextGame() {
      get().client?.nextGame();
    },

    endSession() {
      get().client?.endSession();
    },

    goHome() {
      detach?.();
      detach = null;
      stopSweep();
      stopActing();
      stopReveal();
      exposeView(null);
      set({ screen: 'home', client: null, update: null, selection: null, allHands: null, log: [], sweep: null, celebrating: false, acting: null, flights: NO_FLIGHTS });
    },

    async restart() {
      const setup = get().lastSetup;
      get().goHome();
      if (setup) await get().startMatch(setup);
    },

    toggleDebug() {
      const open = !get().debug.open;
      const client = get().client;
      // Открыли панель — журнал мог отстать (не читался, пока она была закрыта): освежаем сразу.
      set({ debug: { ...get().debug, open }, log: open ? (client?.debug?.log() ?? get().log) : get().log });
    },

    setShowAllHands(on) {
      const client = get().client;
      set({ debug: { ...get().debug, showAllHands: on }, allHands: on ? (client?.debug?.allHands() ?? null) : null });
    },

    setBotSpeed(speed) {
      set({ debug: { ...get().debug, botSpeed: speed } });
      get().client?.debug?.setBotSpeed(speed);
    },

    setAutopilot(on) {
      set({ debug: { ...get().debug, autopilot: on } });
      get().client?.debug?.setAutopilot(on);
    },

    playAs(id) {
      set({ selection: null });
      get().client?.debug?.playAs(id);
    },
  };
});
