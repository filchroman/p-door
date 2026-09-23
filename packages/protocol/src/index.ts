import type { DeckSize, GameEvent, PlayerId, PlayerView, StallRule } from '@vakhta/engine';

/**
 * Общий словарь клиента и сервера: настройки партии, места, сводка сессии, срез для экрана.
 * Ничего отсюда не знает, как устроен хост; зависимость идёт host → protocol и web → protocol.
 */

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
  /** Эмодзи или URL картинки (аватар Telegram). */
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

export * from './messages';
