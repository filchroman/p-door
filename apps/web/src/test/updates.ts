import { viewFor, type GameState, type PlayerId } from '@vakhta/engine';
import type { ClientUpdate, SeatInfo } from '../client/types';
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

/** Тестовое окружение: анимации выключены (очередь срезов сливается сразу), предзагрузка мгновенная. */
export function resetStore(partial: Partial<AppState> = {}): void {
  useAppStore.setState(
    { ...useAppStore.getInitialState(), motionEnabled: false, preload: () => Promise.resolve(), ...partial },
    true,
  );
}
