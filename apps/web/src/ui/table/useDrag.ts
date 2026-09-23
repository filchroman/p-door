import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { dropZones, nearestZone, type DropZone } from './snap';

export const DRAG_THRESHOLD_PX = 6;
/**
 * После броска карта остаётся лежать у цели (заказчик: «я её перетянул, а она потом ещё раз летит»):
 * возвращать её в исходный слот и заново везти к цели незачем. Срез с ходом обычно приходит
 * раньше; если хост ход отверг, карта возвращается сама по этому таймеру.
 */
export const DROP_HOLD_MS = 1500;

export interface DragOptions {
  onTap(): void;
  onDrop(target: string): void;
  accept?: (id: string) => boolean;
}

/**
 * Перетаскивание pointer-событиями (спека §2a): сдвиг пишется прямо в style (без перерисовки React),
 * will-change — только пока тащим; ближайшая подходящая зона в радиусе получает is-snap и принимает карту.
 */
export function useDrag({ onTap, onDrop, accept }: DragOptions) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const node = useRef<HTMLElement | null>(null);
  const snap = useRef<HTMLElement | null>(null);
  /** Зоны обмеряются один раз на перетаскивание, а не на каждое движение пальца. */
  const zones = useRef<DropZone[]>([]);
  /** Коробка самой карты на старте перетаскивания: по ней карта примагничивается к центру зоны. */
  const box = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState(false);

  const stopHold = () => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(() => stopHold, []);

  const setSnap = (zone: HTMLElement | null) => {
    if (snap.current === zone) return;
    snap.current?.classList.remove('is-snap');
    zone?.classList.add('is-snap');
    snap.current = zone;
  };

  const release = () => {
    const el = node.current;
    if (el) {
      el.style.transform = '';
      el.style.willChange = '';
    }
    stopHold();
    setSnap(null);
    zones.current = [];
    start.current = null;
    setDragging(false);
    setDropped(false);
  };

  /** Карта брошена в зону: примагничивается к её центру и лежит там, пока её не заменит срез. */
  const hold = (zone: DropZone) => {
    const el = node.current;
    if (!el) return;
    const rect = zone.rect;
    const from = box.current ?? { x: 0, y: 0 };
    const dx = Math.round((rect.left + rect.right) / 2 - from.x);
    const dy = Math.round((rect.top + rect.bottom) / 2 - from.y);
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.willChange = '';
    setSnap(null);
    zones.current = [];
    start.current = null;
    setDragging(false);
    setDropped(true);
    stopHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      release();
    }, DROP_HOLD_MS);
  };

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      // Только основная кнопка: правая и средняя карту не тащат и не разыгрывают.
      if (e.button !== 0) return;
      // Новое касание снимает прошлый бросок, если срез его ещё не заменил.
      if (dropped) release();
      start.current = { x: e.clientX, y: e.clientY };
      moved.current = false;
      node.current = e.currentTarget;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // окружение без захвата указателя
      }
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const from = start.current;
      const el = node.current;
      if (!from || !el) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (!moved.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        moved.current = true;
        el.style.willChange = 'transform';
        zones.current = dropZones(el, accept);
        const r = el.getBoundingClientRect();
        box.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        setDragging(true);
      }
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      setSnap(nearestZone(zones.current, e.clientX, e.clientY));
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      // Отпустили не основную кнопку — перетаскивание не заканчиваем (у касания button здесь 0 или -1).
      if (e.button > 0) return;
      const wasDrag = moved.current;
      const target = snap.current?.dataset.drop ?? null;
      const zone = zones.current.find((z) => z.el === snap.current) ?? null;
      if (wasDrag && target && zone) {
        hold(zone);
        onDrop(target);
        return;
      }
      release();
    },
    onPointerCancel() {
      moved.current = false;
      release();
    },
    /** Захват указателя потерян (системный жест, смена фокуса) — карта возвращается на место. */
    onLostPointerCapture() {
      release();
    },
    onClick(e: MouseEvent<HTMLElement>) {
      e.stopPropagation();
      if (moved.current) {
        moved.current = false;
        return;
      }
      onTap();
    },
  };

  return { handlers, dragging, dropped };
}
