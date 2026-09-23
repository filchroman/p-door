import { makeDeck, mulberry32, shuffle, type Card, type DeckSize } from '@vakhta/engine';
import { vi } from 'vitest';
import type { HostClock } from '../src/types';

/** Часы поверх глобальных таймеров: под vi.useFakeTimers() ими управляет Vitest. */
export const fakeClock: HostClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Детерминированные часы, ГПСЧ и колоды для хоста. */
export function testHostOptions(seed: number): { clock: HostClock; random: () => number; shuffleDeck: (d: DeckSize) => Card[] } {
  let deckSeed = seed * 1000;
  return {
    clock: fakeClock,
    random: mulberry32(seed),
    shuffleDeck: (deckSize) => shuffle(makeDeck(deckSize), mulberry32(deckSeed++)),
  };
}

/** Крутит фейковое время шагами, пока условие не выполнится; иначе падает. */
export function runUntil(done: () => boolean, limitMs = 3_600_000, stepMs = 250): void {
  for (let t = 0; t < limitMs && !done(); t += stepMs) vi.advanceTimersByTime(stepMs);
  if (!done()) throw new Error(`condition not reached in ${limitMs} ms`);
}
