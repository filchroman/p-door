import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { prefersReducedMotion } from '../anim/reducedMotion';
import { createParticles, stepParticles } from './particles';
import './effects.css';

/** Лёгкий canvas-слой (≤ 150 частиц) только на время анимации; уважает prefers-reduced-motion. */
export function Confetti({ burstKey, durationMs = 2200, count = 120 }: { burstKey: number | string; durationMs?: number; count?: number }) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const reduced = prefersReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  // Какой залп уже доиграл: флагом было не обойтись — сброшенный флаг снова запускал тот же залп,
  // а новый burstKey на уже смонтированном слое не запускался вовсе (canvas был снят).
  const [doneKey, setDoneKey] = useState<number | string | null>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return undefined;
    el.width = el.clientWidth || 360;
    el.height = el.clientHeight || 640;
    let particles = createParticles(count, el.width, Math.random);
    let last = performance.now();
    const started = last;
    let frame = requestAnimationFrame(function draw(now) {
      particles = stepParticles(particles, now - last, el.height);
      last = now;
      ctx.clearRect(0, 0, el.width, el.height);
      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (now - started < durationMs && particles.length > 0) frame = requestAnimationFrame(draw);
      else setDoneKey(burstKey);
    });
    return () => cancelAnimationFrame(frame);
  }, [burstKey, count, durationMs]);

  if (!enabled || reduced || doneKey === burstKey) return null;
  return <canvas ref={canvas} className="confetti" aria-hidden="true" />;
}
