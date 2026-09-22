export const STEP_MS = 280;
export const MIN_STEP_MS = 70;
export const MAX_ANIM_SPEED = 4;

/** Пауза до следующего среза: при отставании короче, но не меньше MIN_STEP_MS. */
export function stepDelay(backlog: number): number {
  return backlog <= 1 ? STEP_MS : Math.max(MIN_STEP_MS, Math.round(STEP_MS / backlog));
}

/** Во сколько раз ускорить анимации текущего шага. */
export function animSpeedFor(backlog: number): number {
  return Math.min(MAX_ANIM_SPEED, Math.max(1, backlog));
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
