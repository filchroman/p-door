import type { Action, DeckSize, GameEvent, PlayerId, StallRule } from '@vakhta/engine';

export type BotSpeed = 0.3 | 1 | 3;
export const BOT_SPEEDS: BotSpeed[] = [0.3, 1, 3];

export type TurnSeconds = 0 | 15 | 30 | 60;
export const TURN_SECONDS: TurnSeconds[] = [0, 15, 30, 60];

export interface SeatInfo {
  id: PlayerId;
  name: string;
  avatar: string;
  isBot: boolean;
}

export interface MatchSettings {
  deckSize: DeckSize;
  turnSeconds: TurnSeconds;
  stallRule: StallRule;
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

export interface LogEntry {
  at: number;
  playerId: PlayerId | null;
  action: Action | null;
  events: GameEvent[];
  error?: string;
  note?: string;
}

export type TimerHandle = unknown;

export interface HostClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const PENALTY_MS = 20_000;
export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_MAX_MS = 1200;
/** Запас после nextDeadline, чтобы окно Вахты точно успело закрыться. */
export const TICK_SLACK_MS = 5;
