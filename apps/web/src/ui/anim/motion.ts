/**
 * Темп карт (спека §2c.1): перелёт 380–520 мс, переворот 300–400 мс. Прежние 180–320 мс заказчик
 * не успевал прочитать — «не видно, как боты берут карты».
 */
export const FLY_MS = 440;
export const FLIP_MS = 340;
export const EXIT_MS = 440;
export const FADE_MS = 150;
/**
 * Нижняя граница перелёта карты (спека §2c.1: 380–520 мс). Догоняющая очередь ускоряет анимации
 * (§2b), но перелёт она укорачивать не имеет права: 110 мс — это и была та «телепортация», из-за
 * которой заказчик не видел ни одного хода. Очередь догоняет паузами, а не невидимыми перелётами.
 */
export const FLY_MIN_MS = 380;
/** Каскад: карты прикупа вылетают по одной, каждая на столько позже предыдущей (спека §2c.3). */
export const STAGGER_MS = 120;
/** Сыгранная карта лежит на столе столько, прежде чем стол уйдёт в отбой (спека §2c.3: 300–400 мс). */
export const DWELL_MS = 350;

/** Сколько лететь карте при текущей скорости очереди: быстрее — да, но не короче FLY_MIN_MS. */
export function flyMs(speed: number): number {
  return Math.max(FLY_MIN_MS, Math.round(FLY_MS / Math.max(1, speed)));
}

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
  return { reduced, initial: { rotateY: 180 }, animate: { rotateY: 0 }, transition: { duration: FLIP_MS / 1000 / k, ease: 'easeOut' } };
}

/** will-change только на время анимации — иначе браузер держит слой каждой карты впустую. */
export function setWillChange(el: HTMLElement | null, on: boolean): void {
  if (el) el.style.willChange = on ? 'transform' : '';
}
