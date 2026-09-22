import type { Action, Card, ErrorCode, GameEvent, PlayerId, PlayerView } from '@vakhta/engine';
import type { BotSpeed, Deadlines, LogEntry, SeatInfo, SessionSummary } from '../host/types';

export type { BotSpeed, Deadlines, LogEntry, SeatInfo, SessionSummary };

export type Intent = Exclude<Action, { type: 'tick' }>;

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

export interface DebugControls {
  playAs(id: PlayerId): void;
  setBotSpeed(speed: BotSpeed): void;
  setAutopilot(on: boolean): void;
  allHands(): Record<PlayerId, Card[]>;
  log(): LogEntry[];
}

export interface AppClient extends GameClient {
  readonly debug: DebugControls;
  snapshot(): ClientUpdate | null;
  dispose(): void;
}
