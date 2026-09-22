import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTION_MIN_MS, CAPTION_MS, CATCHUP_PAUSE_MS, MIN_STEP_MS, STEP_MS, STEP_PAUSE_MS, UpdatePump, animSpeedFor, captionHoldMs, stepDelay } from './updatePump';
import { FLY_MIN_MS, FLY_MS, flyMs } from '../ui/anim/motion';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('UpdatePump', () => {
  it('without animations shows everything at once', () => {
    const shown: [string, number][] = [];
    const pump = new UpdatePump<string>((item, speed) => shown.push([item, speed]), () => false);
    pump.push('a');
    pump.push('b');
    expect(shown).toEqual([['a', 1], ['b', 1]]);
  });

  it('queues fast moves instead of cutting animations off, one step at a time', () => {
    const shown: [string, number][] = [];
    const pump = new UpdatePump<string>((item, speed) => shown.push([item, speed]), () => true);
    pump.push('a');
    pump.push('b');
    pump.push('c');
    expect(shown).toEqual([['a', 1]]);
    expect(pump.backlog).toBe(2);
    vi.advanceTimersByTime(STEP_MS - 1);
    expect(shown).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(shown.at(-1)).toEqual(['b', 2]);
    vi.advanceTimersByTime(stepDelay(2));
    expect(shown.at(-1)).toEqual(['c', 1]);
  });

  it('catches up when it falls behind: shorter steps, faster animations', () => {
    expect(stepDelay(1)).toBe(STEP_MS);
    expect(stepDelay(20)).toBe(MIN_STEP_MS);
    expect(animSpeedFor(1)).toBe(1);
    expect(animSpeedFor(3)).toBe(3);
    expect(animSpeedFor(30)).toBe(4);
  });

  /**
   * Спека §2c: действие видно не меньше, чем длится его анимация — иначе ходы наложатся, а карта
   * пропадёт из воздуха вместе с перерисованным приёмником (это и резало перелёты до 165 мс).
   */
  it('never shows a step for less than its own flight, and always leaves a gap after it', () => {
    for (let backlog = 1; backlog <= 30; backlog++) {
      expect(stepDelay(backlog)).toBeGreaterThan(flyMs(animSpeedFor(backlog)));
      expect(stepDelay(backlog)).toBeGreaterThanOrEqual(FLY_MIN_MS + CATCHUP_PAUSE_MS);
    }
  });

  it('between two actions: the flight plus at least 250 ms (§2c.1)', () => {
    expect(STEP_PAUSE_MS).toBeGreaterThanOrEqual(250);
    expect(stepDelay(1)).toBe(FLY_MS + STEP_PAUSE_MS);
    expect(captionHoldMs(1)).toBe(CAPTION_MS);
    // Ускорение очереди укорачивает подпись, но она живёт не меньше 900 мс и не меньше самого шага.
    expect(captionHoldMs(4)).toBeGreaterThanOrEqual(CAPTION_MIN_MS);
    expect(captionHoldMs(4)).toBeGreaterThanOrEqual(stepDelay(4));
    for (const speed of [1, 2, 3, 4, 10]) expect(captionHoldMs(speed)).toBeGreaterThanOrEqual(CAPTION_MIN_MS);
  });

  it('clear drops the backlog', () => {
    const shown: string[] = [];
    const pump = new UpdatePump<string>((item) => shown.push(item), () => true);
    pump.push('a');
    pump.push('b');
    pump.clear();
    vi.advanceTimersByTime(STEP_MS * 3);
    expect(shown).toEqual(['a']);
  });
});
