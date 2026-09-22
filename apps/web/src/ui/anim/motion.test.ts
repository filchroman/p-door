import { describe, expect, it } from 'vitest';
import { EXIT_MS, FADE_MS, FLIP_MS, FLY_MS, cardMotion, flipMotion, sweepMs } from './motion';

const ALLOWED = new Set(['x', 'y', 'scale', 'rotate', 'rotateY', 'opacity', 'transition']);
const keysOf = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v) : []);

describe('cardMotion', () => {
  it('animates only transform and opacity, 380–520 ms, ease-out (§2c.1)', () => {
    const m = cardMotion({ reduced: false, speed: 1 });
    for (const part of [m.initial, m.animate]) for (const key of keysOf(part)) expect(ALLOWED.has(key)).toBe(true);
    expect(m.layoutId).toBe(true);
    expect(m.transition.duration * 1000).toBe(FLY_MS);
    expect(FLY_MS).toBeGreaterThanOrEqual(380);
    expect(FLY_MS).toBeLessThanOrEqual(520);
    expect(EXIT_MS).toBeGreaterThanOrEqual(380);
    expect(EXIT_MS).toBeLessThanOrEqual(520);
    expect(FLIP_MS).toBeGreaterThanOrEqual(300);
    expect(FLIP_MS).toBeLessThanOrEqual(400);
    expect(m.transition.ease).toBe('easeOut');
  });

  it('speeds up when the queue catches up', () => {
    expect(cardMotion({ reduced: false, speed: 2 }).transition.duration * 1000).toBe(FLY_MS / 2);
  });

  it('reduced motion: a short fade, no flight', () => {
    const m = cardMotion({ reduced: true, speed: 1 });
    expect(m.layoutId).toBe(false);
    expect([...keysOf(m.initial), ...keysOf(m.animate)].every((k) => k === 'opacity')).toBe(true);
    expect(m.transition.duration).toBeLessThanOrEqual(0.15);
  });
});

describe('sweepMs', () => {
  it('the swept table flies for the exit beat, faster when the queue catches up, a short fade with less motion', () => {
    expect(sweepMs(1, false)).toBe(EXIT_MS);
    expect(sweepMs(2, false)).toBe(EXIT_MS / 2);
    expect(sweepMs(0.5, false)).toBe(EXIT_MS);
    expect(sweepMs(1, true)).toBe(FADE_MS);
  });
});

describe('flipMotion', () => {
  it('turns the card over on transform only, and speeds up with the queue just like a flight', () => {
    const m = flipMotion({ reduced: false, speed: 1 });
    for (const part of [m.initial, m.animate]) for (const key of keysOf(part)) expect(ALLOWED.has(key)).toBe(true);
    expect(m.initial).toEqual({ rotateY: 180 });
    expect(m.transition).toEqual({ duration: FLIP_MS / 1000, ease: 'easeOut' });
    expect(flipMotion({ reduced: false, speed: 2 }).transition.duration * 1000).toBe(FLIP_MS / 2);
    expect(flipMotion({ reduced: false, speed: 0.5 }).transition.duration * 1000).toBe(FLIP_MS);
  });

  it('reduced motion: a short fade that speeds up too', () => {
    const m = flipMotion({ reduced: true, speed: 1 });
    expect(m.reduced).toBe(true);
    expect([...keysOf(m.initial), ...keysOf(m.animate)].every((k) => k === 'opacity')).toBe(true);
    expect(m.transition.duration * 1000).toBe(FADE_MS);
    expect(flipMotion({ reduced: true, speed: 3 }).transition.duration * 1000).toBeCloseTo(FADE_MS / 3, 6);
  });
});
