export const SNAP_RADIUS_PX = 72;

export interface DropZone {
  el: HTMLElement;
  id: string;
  rect: { left: number; top: number; right: number; bottom: number };
}

/**
 * Снимок зон сброса на начало перетаскивания: обмер (`getBoundingClientRect`) стоит дорого,
 * и делать его на каждое движение пальца — терять кадры (спека §2a — плавность).
 * Зона, где лежит сама карта, и зоны, которых вызывающий не принимает, в снимок не попадают.
 */
export function dropZones(dragged: Element | null, accept: (id: string) => boolean = () => true): DropZone[] {
  const zones: DropZone[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-drop]')) {
    const id = el.dataset.drop!;
    if (!accept(id) || (dragged && el.contains(dragged))) continue;
    zones.push({ el, id, rect: el.getBoundingClientRect() });
  }
  return zones;
}

/** Ближайшая к точке зона из снятых заранее (0 — точка внутри зоны). */
export function nearestZone(zones: DropZone[], x: number, y: number, radius: number = SNAP_RADIUS_PX): HTMLElement | null {
  let best: { zone: HTMLElement; distance: number } | null = null;
  for (const { el, rect } of zones) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance <= radius && (!best || distance < best.distance)) best = { zone: el, distance };
  }
  return best?.zone ?? null;
}
