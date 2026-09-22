import { describe, expect, it } from 'vitest';
import { EXIT_MS, FADE_MS, FLY_MS, cardMotion, flipMotion } from './motion';

const ALLOWED = new Set(['x', 'y', 'scale', 'rotate', 'rotateY', 'opacity', 'transition']);
const keysOf = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v) : []);

describe('cardMotion', () => {
  it('animates only transform and opacity, 180–320 ms, ease-out', () => {
    const m = cardMotion({ reduced: false, speed: 1, exit: true });
    for (const part of [m.initial, m.animate, m.exit]) for (const key of keysOf(part)) expect(ALLOWED.has(key)).toBe(true);
    expect(m.layoutId).toBe(true);
    expect(m.transition.duration * 1000).toBe(FLY_MS);
    expect(FLY_MS).toBeGreaterThanOrEqual(180);
    expect(EXIT_MS).toBeLessThanOrEqual(320);
    expect(m.transition.ease).toBe('easeOut');
  });

  it('speeds up when the queue catches up', () => {
    expect(cardMotion({ reduced: false, speed: 2, exit: false }).transition.duration * 1000).toBe(FLY_MS / 2);
  });

  it('reduced motion: a short fade, no flight', () => {
    const m = cardMotion({ reduced: true, speed: 1, exit: true });
    expect(m.layoutId).toBe(false);
    expect([...keysOf(m.initial), ...keysOf(m.animate)].every((k) => k === 'opacity')).toBe(true);
    expect(m.transition.duration).toBeLessThanOrEqual(0.15);
  });
});

describe('flipMotion', () => {
  it('turns the card over on transform only, and speeds up with the queue just like a flight', () => {
    const m = flipMotion({ reduced: false, speed: 1 });
    for (const part of [m.initial, m.animate]) for (const key of keysOf(part)) expect(ALLOWED.has(key)).toBe(true);
    expect(m.initial).toEqual({ rotateY: 180 });
    expect(m.transition).toEqual({ duration: FLY_MS / 1000, ease: 'easeOut' });
    expect(flipMotion({ reduced: false, speed: 2 }).transition.duration * 1000).toBe(FLY_MS / 2);
    expect(flipMotion({ reduced: false, speed: 0.5 }).transition.duration * 1000).toBe(FLY_MS);
  });

  it('reduced motion: a short fade that speeds up too', () => {
    const m = flipMotion({ reduced: true, speed: 1 });
    expect(m.reduced).toBe(true);
    expect([...keysOf(m.initial), ...keysOf(m.animate)].every((k) => k === 'opacity')).toBe(true);
    expect(m.transition.duration * 1000).toBe(FADE_MS);
    expect(flipMotion({ reduced: true, speed: 3 }).transition.duration * 1000).toBeCloseTo(FADE_MS / 3, 6);
  });
});
