import { FLY_MS } from '../ui/anim/motion';

/**
 * Пауза между действиями (спека §2c «Каждое действие видно отдельно»): карта успевает долететь,
 * и ещё остаётся видимый промежуток, прежде чем начнётся следующее действие.
 */
export const STEP_PAUSE_MS = 250;
export const STEP_MS = FLY_MS + STEP_PAUSE_MS;
/**
 * Нижняя граница шага при отставании: самая быстрая анимация (FLY_MS / MAX_ANIM_SPEED) плюс
 * видимый зазор. Без зазора на «догоняющей» скорости следующее действие начиналось бы ровно в тот
 * кадр, в который приземлялось предыдущее, — действия снова слипались бы.
 */
export const MAX_ANIM_SPEED = 4;
export const CATCHUP_PAUSE_MS = 60;
export const MIN_STEP_MS = Math.ceil(FLY_MS / MAX_ANIM_SPEED) + CATCHUP_PAUSE_MS;
/** Сколько висит подпись «кто что сделал», если следующего действия так и не случилось. */
export const CAPTION_MS = 1600;
/** Подпись держится не меньше этого даже на догоняющей очереди (спека §2c.1: ≥ 900 мс). */
export const CAPTION_MIN_MS = 900;
/** И гаснет плавно, а не пропадает кадром. */
export const CAPTION_FADE_MS = 240;

/** Пауза до следующего среза: при отставании короче, но не меньше MIN_STEP_MS. */
export function stepDelay(backlog: number): number {
  return backlog <= 1 ? STEP_MS : Math.max(MIN_STEP_MS, Math.round(STEP_MS / backlog));
}

/** Во сколько раз ускорить анимации текущего шага. */
export function animSpeedFor(backlog: number): number {
  return Math.min(MAX_ANIM_SPEED, Math.max(1, backlog));
}

/** Подпись держится дольше шага очереди, но не меньше CAPTION_MIN_MS (спека §2c.1). */
export function captionHoldMs(speed: number): number {
  return Math.max(CAPTION_MIN_MS, stepDelay(speed), Math.round(CAPTION_MS / Math.max(1, speed)));
}

/**
 * Очередь анимаций (спека §2b): быстрые ходы ботов не обрывают друг друга — срезы показываются
 * по одному, каждому даётся время доиграть; очередь догоняет состояние, ускоряясь при отставании.
 */
export class UpdatePump<T> {
  private queue: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly show: (item: T, speed: number) => void,
    private readonly animated: () => boolean,
  ) {}

  get backlog(): number {
    return this.queue.length;
  }

  push(item: T): void {
    this.queue.push(item);
    this.pump();
  }

  clear(): void {
    this.queue = [];
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private pump(): void {
    if (this.timer !== null) return;
    if (!this.animated()) {
      while (this.queue.length > 0) this.show(this.queue.shift()!, 1);
      return;
    }
    const next = this.queue.shift();
    if (next === undefined) return;
    const backlog = this.queue.length + 1;
    this.show(next, animSpeedFor(backlog));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pump();
    }, stepDelay(backlog));
  }
}
