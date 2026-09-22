export const SNAP_RADIUS_PX = 72;

/** Ближайшая зона сброса к точке (0 — точка внутри), кроме зоны, где лежит сама карта. */
export function nearestDropZone(
  x: number,
  y: number,
  dragged: Element | null,
  accept: (id: string) => boolean = () => true,
  radius: number = SNAP_RADIUS_PX,
): HTMLElement | null {
  let best: { zone: HTMLElement; distance: number } | null = null;
  for (const zone of document.querySelectorAll<HTMLElement>('[data-drop]')) {
    const id = zone.dataset.drop!;
    if (!accept(id) || (dragged && zone.contains(dragged))) continue;
    const r = zone.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance <= radius && (!best || distance < best.distance)) best = { zone, distance };
  }
  return best?.zone ?? null;
}
