import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { dropZones, nearestZone, type DropZone } from './snap';

export const DRAG_THRESHOLD_PX = 6;

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
  const [dragging, setDragging] = useState(false);

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
    setSnap(null);
    zones.current = [];
    start.current = null;
    setDragging(false);
  };

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      // Только основная кнопка: правая и средняя карту не тащат и не разыгрывают.
      if (e.button !== 0) return;
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
      release();
      if (wasDrag && target) onDrop(target);
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

  return { handlers, dragging };
}
