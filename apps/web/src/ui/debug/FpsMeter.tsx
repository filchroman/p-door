import { useEffect, useRef } from 'react';
import { ru } from '../../i18n/ru';
import { fpsOf } from './fps';

const WINDOW_MS = 1000;
const PAINT_MS = 500;

/** Число пишется прямо в DOM дважды в секунду — сам счётчик не нагружает React. */
export function FpsMeter() {
  const out = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const frames: number[] = [];
    let lastPaint = 0;
    let id = requestAnimationFrame(function tick(now) {
      frames.push(now);
      while (frames.length > 0 && now - frames[0] > WINDOW_MS) frames.shift();
      if (now - lastPaint > PAINT_MS && out.current) {
        out.current.textContent = String(fpsOf(frames, WINDOW_MS, now));
        lastPaint = now;
      }
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <output ref={out} className="fps" aria-label={ru.debug.fps}>
      0
    </output>
  );
}
