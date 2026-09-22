/** Коробка источника перелёта в координатах окна: угол и размер (по нему считается масштаб). */
export interface Origin {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Где сейчас на экране зона `data-zone`. Нужна, когда источник перелёта исчезает вместе со срезом
 * (прикуп ушёл в руку): точку снимают с ещё не перерисованного экрана и отдают приёмнику.
 * Берётся не коробка зоны, а её верхняя (последняя) карта: зона бывает заметно больше карты
 * (стол — полторы высоты), и перелёт из её угла начинался бы не оттуда, где карту видно.
 * Пустая или неразмеченная зона — null: лучше без перелёта, чем перелёт из угла экрана.
 */
export function zoneOrigin(zone: string): Origin | null {
  const el = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-zone="${zone}"]`);
  if (!el) return null;
  const cards = el.querySelectorAll<HTMLElement>('.card');
  return boxOf(cards[cards.length - 1] ?? el);
}

/**
 * Где сейчас на экране сама карта. Точнее зоны: карта в стопке или в веере лежит не в её углу,
 * и перелёт должен начинаться ровно оттуда, где карту видно.
 */
export function cardOrigin(key: string): Origin | null {
  if (typeof document === 'undefined') return null;
  return boxOf(document.querySelector<HTMLElement>(`[data-card="${key}"]`));
}

function boxOf(el: HTMLElement | null): Origin | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}
