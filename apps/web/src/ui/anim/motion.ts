export const FLY_MS = 260;
export const EXIT_MS = 300;
export const FADE_MS = 150;

export interface MotionTransition {
  duration: number;
  ease: 'easeOut';
}

/** Только свойства transform и opacity. */
export interface MotionTarget {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  rotateY?: number;
  opacity?: number;
  transition?: MotionTransition;
}

export interface CardMotion {
  layoutId: boolean;
  initial: MotionTarget;
  animate: MotionTarget;
  transition: MotionTransition;
}

/**
 * Только transform и opacity (спека §2a); speed > 1 — очередь догоняет состояние (§2b).
 * Ухода здесь нет: карта либо переезжает в другую зону одним элементом по общему layoutId,
 * либо уходит в отбой отдельным слоем (sweepMs) — в зоне остаются ровно карты среза.
 */
export function cardMotion({ reduced, speed }: { reduced: boolean; speed: number }): CardMotion {
  const k = Math.max(1, speed);
  if (reduced) {
    const fade = { duration: FADE_MS / 1000 / k, ease: 'easeOut' as const };
    return { layoutId: false, initial: { opacity: 0 }, animate: { opacity: 1 }, transition: fade };
  }
  return {
    layoutId: true,
    initial: { y: -40, scale: 0.85 },
    animate: { y: 0, scale: 1 },
    transition: { duration: FLY_MS / 1000 / k, ease: 'easeOut' },
  };
}

/** Сколько улетает отбитый стол: столько же живёт слой отбоя, потом от него не остаётся ничего. */
export function sweepMs(speed: number, reduced: boolean): number {
  return Math.round((reduced ? FADE_MS : EXIT_MS) / Math.max(1, speed));
}

export interface FlipMotion {
  /** true — вместо переворота короткое затухание. */
  reduced: boolean;
  initial: MotionTarget;
  animate: MotionTarget;
  transition: MotionTransition;
}

/** Переворот рубашкой вверх; как и перелёты, ускоряется, когда очередь срезов догоняет состояние (§2b). */
export function flipMotion({ reduced, speed }: { reduced: boolean; speed: number }): FlipMotion {
  const k = Math.max(1, speed);
  if (reduced) {
    return { reduced, initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: FADE_MS / 1000 / k, ease: 'easeOut' } };
  }
  return { reduced, initial: { rotateY: 180 }, animate: { rotateY: 0 }, transition: { duration: FLY_MS / 1000 / k, ease: 'easeOut' } };
}

/** will-change только на время анимации — иначе браузер держит слой каждой карты впустую. */
export function setWillChange(el: HTMLElement | null, on: boolean): void {
  if (el) el.style.willChange = on ? 'transform' : '';
}
