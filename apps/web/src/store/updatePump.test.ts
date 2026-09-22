import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_STEP_MS, STEP_MS, UpdatePump, animSpeedFor, stepDelay } from './updatePump';

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
