import { describe, expect, it } from 'vitest';
import { EXIT_MS, FLY_MS, cardMotion } from './motion';

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
