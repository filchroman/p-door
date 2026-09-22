import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle } from '../src/rng';

describe('rng', () => {
  it('same seed gives same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });

  it('values are in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('shuffle is a deterministic permutation and does not mutate input', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const s1 = shuffle(input, mulberry32(1));
    const s2 = shuffle(input, mulberry32(1));
    const s3 = shuffle(input, mulberry32(2));
    expect(s1).toEqual(s2);
    expect(s1).not.toEqual(s3);
    expect([...s1].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});
