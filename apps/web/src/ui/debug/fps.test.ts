import { describe, expect, it } from 'vitest';
import { fpsOf } from './fps';

describe('fpsOf', () => {
  it('counts frames in the last window', () => {
    const frames = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));
    expect(fpsOf(frames, 1000, 1000)).toBe(60);
    expect(fpsOf(frames.filter((_, i) => i % 2 === 0), 1000, 1000)).toBe(30);
    expect(fpsOf([], 1000, 1000)).toBe(0);
  });
});
