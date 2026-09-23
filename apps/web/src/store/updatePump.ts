import { FLY_MIN_MS, FLY_MS } from '../ui/anim/motion';

/**
 * Пауза между действиями (спека §2c «Каждое действие видно отдельно»): карта успевает долететь,
 * и ещё остаётся видимый промежуток, прежде чем начнётся следующее действие.
 */
export const STEP_PAUSE_MS = 250;
export const STEP_MS = FLY_MS + STEP_PAUSE_MS;
/**
 * Нижняя граница шага при отставании: самый короткий перелёт (FLY_MIN_MS) плюс видимый зазор.
 * Раньше здесь стояло FLY_MS / MAX_ANIM_SPEED = 110 мс, и следующий срез приходил, пока карта была
 * ещё в воздухе: приёмник перерисовывался, летящая копия уходила из DOM, и ход обрывался на
 * середине — в браузере такие перелёты длились 165 и 218 мс вместо 440 (спека §2c.1). Очередь
 * догоняет состояние более короткими паузами, но не обрывая сам перелёт.
 */
export const MAX_ANIM_SPEED = 4;
export const CATCHUP_PAUSE_MS = 60;
export const MIN_STEP_MS = FLY_MIN_MS + CATCHUP_PAUSE_MS;
/**
 * Показ козыря (заказчик): последняя карта колоды вылетает в слот, переворачивается и лежит,
 * прежде чем откроется фаза 2 — иначе переход происходит мгновенно и её никто не видит.
 */
export const TRUMP_REVEAL_MS = FLY_MS + 1000;
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

  /**
   * `show` может вернуть, сколько миллисекунд этому срезу нужно на экране (например,
   * «побил → пауза → отбой» длиннее одного перелёта): следующий срез придёт не раньше.
   */
  constructor(
    private readonly show: (item: T, speed: number) => number | void,
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
    const hold = this.show(next, animSpeedFor(backlog)) ?? 0;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pump();
    }, Math.max(stepDelay(backlog), hold + CATCHUP_PAUSE_MS));
  }
}
