import type { Action, ErrorCode, PlayerId } from '@vakhta/engine';
import type { ClientUpdate } from '@vakhta/protocol';
import type { DebugControls } from './debug';

/**
 * Шов клиента: только то, что одинаково у локального хоста и сетевого клиента.
 * Общий словарь (настройки, места, сводка, срез) живёт в `@vakhta/protocol`.
 */
export type { ClientUpdate, Deadlines, MatchSettings, SeatInfo, SessionStatus, SessionSummary, TurnSeconds } from '@vakhta/protocol';
export { TURN_SECONDS } from '@vakhta/protocol';

export type Intent = Exclude<Action, { type: 'tick' }>;

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
