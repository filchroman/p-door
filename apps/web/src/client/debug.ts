import type { Action, Card, GameEvent, PlayerId } from '@vakhta/engine';

/**
 * Отладочный шов: всё, что умеет только локальный хост (панель отладки живёт рядом с ним).
 * Сетевой клиент его не реализует — `AppClient.debug` поэтому необязателен.
 */

export type BotSpeed = 0.3 | 1 | 3;
export const BOT_SPEEDS: BotSpeed[] = [0.3, 1, 3];

export interface LogEntry {
  at: number;
  playerId: PlayerId | null;
  action: Action | null;
  events: GameEvent[];
  error?: string;
  note?: string;
}

export interface DebugControls {
  playAs(id: PlayerId): void;
  setBotSpeed(speed: BotSpeed): void;
  setAutopilot(on: boolean): void;
  allHands(): Record<PlayerId, Card[]>;
  log(): LogEntry[];
}
