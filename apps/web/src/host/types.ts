/** Только внутреннее устройство локального хоста: общий с клиентом словарь живёт в `client/types.ts`. */

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
