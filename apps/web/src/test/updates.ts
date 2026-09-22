import { viewFor, type GameState, type PlayerId } from '@vakhta/engine';
import type { AppClient, ClientUpdate, SeatInfo } from '../client/types';
import { useAppStore, type AppState } from '../store/appStore';

/** Места по состоянию: первое — человек, имя = id, если не задано. */
export function seatsFor(state: GameState, names: Record<string, string> = {}): SeatInfo[] {
  return state.players.map((p, i) => ({ id: p.id, name: names[p.id] ?? p.id, avatar: '🙂', isBot: i !== 0 }));
}

export function makeUpdate(state: GameState, me: PlayerId, extra: Partial<ClientUpdate> = {}): ClientUpdate {
  return {
    view: viewFor(state, me, 0),
    events: [],
    session: { gameNumber: 1, losses: {}, vakhterId: null, status: 'playing', canContinue: true },
    players: seatsFor(state),
    deadlines: { turnEndsAt: null, turnTotalMs: null, penaltyEndsAt: null, penaltyTotalMs: null },
    ...extra,
  };
}

/**
 * Клиент-заглушка: срезы приходят тогда и такие, какие велит тест (через очередь стора).
 * `withDebug: false` — клиент без отладочного шва, каким будет сетевой.
 */
export function fakeClient(first: ClientUpdate, { withDebug = true } = {}): { client: AppClient; emit: (update: ClientUpdate) => void } {
  let listener: ((update: ClientUpdate) => void) | null = null;
  const client: AppClient = {
    subscribe(l) {
      listener = l;
      return () => {
        listener = null;
      };
    },
    send() {},
    me: () => first.view.me,
    onError: () => () => {},
    nextGame() {},
    endSession() {},
    debug: withDebug ? { playAs() {}, setBotSpeed() {}, setAutopilot() {}, allHands: () => ({}), log: () => [] } : undefined,
    snapshot: () => first,
    dispose() {},
  };
  return { client, emit: (update) => listener?.(update) };
}

/** Тестовое окружение: анимации выключены (очередь срезов сливается сразу), предзагрузка мгновенная. */
export function resetStore(partial: Partial<AppState> = {}): void {
  useAppStore.setState(
    { ...useAppStore.getInitialState(), motionEnabled: false, preload: () => Promise.resolve(), ...partial },
    true,
  );
}
