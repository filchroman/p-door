import type { CSSProperties } from 'react';

/** Статичный сдвиг слоя стопки/колоды: высоту видно, но ничего не анимируется. */
export function layerOffset(index: number): CSSProperties {
  const shift = -Math.min(Math.floor(index / 3), 8) * 0.8;
  return { transform: `translate(${shift}px, ${shift}px)` };
}
