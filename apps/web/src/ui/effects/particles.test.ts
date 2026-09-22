import { mulberry32 } from '@vakhta/engine';
import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, createParticles, stepParticles } from './particles';

describe('confetti physics', () => {
  it('never creates more than 150 particles', () => {
    expect(createParticles(1000, 400, mulberry32(1))).toHaveLength(MAX_PARTICLES);
    expect(createParticles(40, 400, mulberry32(1))).toHaveLength(40);
  });

  it('particles fall and leave the screen', () => {
    let ps = createParticles(20, 400, mulberry32(2));
    const y0 = ps[0].y;
    ps = stepParticles(ps, 100, 800);
    expect(ps[0].y).not.toBe(y0);
    for (let i = 0; i < 200 && ps.length > 0; i++) ps = stepParticles(ps, 50, 800);
    expect(ps).toHaveLength(0);
  });
});
