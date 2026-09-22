/** Левый верхний угол источника перелёта в координатах окна. */
export interface Origin {
  x: number;
  y: number;
}

/**
 * Где сейчас на экране зона `data-zone`. Нужна, когда источник перелёта исчезает вместе со срезом
 * (прикуп ушёл в руку): точку снимают с ещё не перерисованного экрана и отдают приёмнику.
 * Пустая или неразмеченная зона — null: лучше без перелёта, чем перелёт из угла экрана.
 */
export function zoneOrigin(zone: string): Origin | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(`[data-zone="${zone}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left, y: rect.top };
}
