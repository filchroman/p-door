import type { Action, DeckSize, ErrorCode, GameEvent, PlayerId, PlayerView, StallRule } from '@vakhta/engine';
import type { DebugControls } from './debug';

/**
 * Шов клиента: только то, что одинаково у локального хоста и будущего сетевого (Socket.io).
 * Ничего отсюда не знает про то, как устроен хост, — зависимость идёт строго host → client.
 */

export type Intent = Exclude<Action, { type: 'tick' }>;

export type TurnSeconds = 0 | 15 | 30 | 60;
export const TURN_SECONDS: TurnSeconds[] = [0, 15, 30, 60];

export interface MatchSettings {
  deckSize: DeckSize;
  turnSeconds: TurnSeconds;
  stallRule: StallRule;
}

export interface SeatInfo {
  id: PlayerId;
  name: string;
  avatar: string;
  isBot: boolean;
}

export type SessionStatus = 'playing' | 'gameOver' | 'sessionOver' | 'crashed';

export interface SessionSummary {
  gameNumber: number;
  losses: Record<PlayerId, number>;
  vakhterId: PlayerId | null;
  status: SessionStatus;
  /** Хватит ли карт на следующую раздачу (прикупы растут с поражениями). */
  canContinue: boolean;
}

export interface Deadlines {
  turnEndsAt: number | null;
  /** Полная длительность таймера хода — для CSS-полоски отсчёта. */
  turnTotalMs: number | null;
  penaltyEndsAt: number | null;
  penaltyTotalMs: number | null;
}

export interface ClientUpdate {
  view: PlayerView;
  events: GameEvent[];
  session: SessionSummary;
  players: SeatInfo[];
  deadlines: Deadlines;
}

/** То, что потом реализует и сетевой клиент (Socket.io). */
export interface GameClient {
  subscribe(listener: (update: ClientUpdate) => void): () => void;
  send(intent: Intent): void;
  me(): PlayerId;
  onError(listener: (code: ErrorCode) => void): () => void;
  nextGame(): void;
  endSession(): void;
}

export interface AppClient extends GameClient {
  /** Есть только у локального хоста: сетевой клиент отладочного шва не даёт. */
  readonly debug?: DebugControls;
  snapshot(): ClientUpdate | null;
  dispose(): void;
}
