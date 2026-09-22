import { afterEach, describe, expect, it } from 'vitest';
import { dropZones, nearestZone } from './snap';

let measured = 0;

function place(id: string, left: number, top: number, width = 60, height = 90): HTMLElement {
  const zone = document.createElement('div');
  zone.dataset.drop = id;
  zone.getBoundingClientRect = () => {
    measured++;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  };
  document.body.append(zone);
  return zone;
}

const nearest = (x: number, y: number, dragged: Element | null = null, accept?: (id: string) => boolean) =>
  nearestZone(dropZones(dragged, accept), x, y);

afterEach(() => {
  document.body.innerHTML = '';
  measured = 0;
});

describe('drop zones', () => {
  it('returns the zone under the pointer', () => {
    place('A', 0, 0);
    const b = place('B', 100, 0);
    expect(nearest(120, 40)).toBe(b);
  });

  it('snaps to the nearest zone within the radius and ignores farther ones', () => {
    const a = place('A', 0, 0);
    place('B', 200, 0);
    expect(nearest(100, 40)).toBe(a);
    expect(nearest(100, 300)).toBeNull();
  });

  it('skips the zone that holds the dragged card and zones the caller does not accept', () => {
    const own = place('A', 0, 0);
    const card = document.createElement('div');
    own.append(card);
    const table = place('table', 70, 0);
    place('B', 70, 100);
    expect(nearest(30, 40, card)).toBe(table);
    expect(nearest(100, 60, null, (id) => id === 'B')?.dataset.drop).toBe('B');
  });

  /** Обмер стоит дорого: на каждое движение пальца его больше не делаем (спека §2a — плавность). */
  it('measures the zones once per drag, not on every pointer move', () => {
    place('A', 0, 0);
    place('B', 100, 0);
    const zones = dropZones(null);
    expect(measured).toBe(2);
    for (let x = 0; x < 50; x++) nearestZone(zones, x, 40);
    expect(measured).toBe(2);
  });
});
