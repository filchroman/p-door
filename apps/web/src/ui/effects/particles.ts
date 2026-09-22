export const MAX_PARTICLES = 150;
const COLORS = ['#ffd54f', '#ef5350', '#42a5f5', '#66bb6a', '#ffffff', '#ab47bc'];
const GRAVITY = 0.0012; // px/мс²

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
  color: string;
}

export function createParticles(count: number, width: number, random: () => number): Particle[] {
  return Array.from({ length: Math.min(count, MAX_PARTICLES) }, () => ({
    x: width / 2 + (random() - 0.5) * width * 0.4,
    y: -10 - random() * 40,
    vx: (random() - 0.5) * 0.5,
    vy: 0.1 + random() * 0.3,
    angle: random() * Math.PI,
    spin: (random() - 0.5) * 0.02,
    size: 5 + random() * 5,
    color: COLORS[Math.floor(random() * COLORS.length)],
  }));
}

export function stepParticles(particles: Particle[], dtMs: number, height: number): Particle[] {
  return particles
    .map((p) => ({ ...p, x: p.x + p.vx * dtMs, y: p.y + p.vy * dtMs, vy: p.vy + GRAVITY * dtMs, angle: p.angle + p.spin * dtMs }))
    .filter((p) => p.y < height + 20);
}
