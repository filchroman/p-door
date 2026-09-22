import type { Card, DeckSize, PlayerId } from '@vakhta/engine';
import { create } from 'zustand';
import { preloadDeck } from '../cards/preload';
import { createLocalMatch, type MatchSetup } from '../client/createLocalMatch';
import type { AppClient, BotSpeed, ClientUpdate, Intent, LogEntry } from '../client/types';
import { VIBRATE_ERROR, vibrate } from '../ui/haptics';
import {
  emptyMarks,
  errorText,
  eventToasts,
  keepSelection,
  nextMarks,
  type RecentMarks,
  type Selection,
  type ToastSpec,
  type ToastTone,
} from './derive';
import { UpdatePump } from './updatePump';

export type Screen = 'home' | 'loading' | 'game';

export interface Toast extends ToastSpec {
  id: number;
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
  makeClient: (setup: MatchSetup) => AppClient;
  preload: (deckSize: DeckSize) => Promise<void>;
  startMatch(setup: MatchSetup): Promise<void>;
  send(intent: Intent): void;
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

export const useAppStore = create<AppState>()((set, get) => {
  const show = (update: ClientUpdate, speed: number) => {
    const { marks, selection, debug, client } = get();
    set({
      update,
      animSpeed: speed,
      marks: nextMarks(marks, update),
      selection: keepSelection(selection, update.view),
      allHands: debug.showAllHands && client ? client.debug.allHands() : null,
      log: client ? client.debug.log() : [],
    });
    for (const toast of eventToasts(update)) get().pushToast(toast.text, toast.tone);
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
    makeClient: (setup) => createLocalMatch(setup),
    preload: (deckSize) => preloadDeck(deckSize),

    async startMatch(setup) {
      set({ screen: 'loading', lastSetup: setup });
      await get().preload(setup.settings.deckSize);
      if (get().screen !== 'loading') return;
      const client = get().makeClient(setup);
      attach(client);
      const { debug } = get();
      client.debug.setBotSpeed(debug.botSpeed);
      client.debug.setAutopilot(debug.autopilot);
      const update = client.snapshot();
      set({
        client,
        screen: 'game',
        update,
        animSpeed: 1,
        marks: emptyMarks(update?.session.gameNumber ?? 0),
        selection: null,
        allHands: debug.showAllHands ? client.debug.allHands() : null,
        log: client.debug.log(),
      });
    },

    send(intent) {
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
      set({ screen: 'home', client: null, update: null, selection: null, allHands: null, log: [] });
    },

    async restart() {
      const setup = get().lastSetup;
      get().goHome();
      if (setup) await get().startMatch(setup);
    },

    toggleDebug() {
      set({ debug: { ...get().debug, open: !get().debug.open } });
    },

    setShowAllHands(on) {
      const client = get().client;
      set({ debug: { ...get().debug, showAllHands: on }, allHands: on && client ? client.debug.allHands() : null });
    },

    setBotSpeed(speed) {
      set({ debug: { ...get().debug, botSpeed: speed } });
      get().client?.debug.setBotSpeed(speed);
    },

    setAutopilot(on) {
      set({ debug: { ...get().debug, autopilot: on } });
      get().client?.debug.setAutopilot(on);
    },

    playAs(id) {
      set({ selection: null });
      get().client?.debug.playAs(id);
    },
  };
});
