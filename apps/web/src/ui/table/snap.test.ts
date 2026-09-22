import { afterEach, describe, expect, it } from 'vitest';
import { nearestDropZone } from './snap';

function place(id: string, left: number, top: number, width = 60, height = 90): HTMLElement {
  const zone = document.createElement('div');
  zone.dataset.drop = id;
  zone.getBoundingClientRect = () => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) });
  document.body.append(zone);
  return zone;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('nearestDropZone', () => {
  it('returns the zone under the pointer', () => {
    place('A', 0, 0);
    const b = place('B', 100, 0);
    expect(nearestDropZone(120, 40, null)).toBe(b);
  });

  it('snaps to the nearest zone within the radius and ignores farther ones', () => {
    const a = place('A', 0, 0);
    place('B', 200, 0);
    expect(nearestDropZone(100, 40, null)).toBe(a);
    expect(nearestDropZone(100, 300, null)).toBeNull();
  });

  it('skips the zone that holds the dragged card and zones the caller does not accept', () => {
    const own = place('A', 0, 0);
    const card = document.createElement('div');
    own.append(card);
    const table = place('table', 70, 0);
    place('B', 70, 100);
    expect(nearestDropZone(30, 40, card)).toBe(table);
    expect(nearestDropZone(100, 60, null, (id) => id === 'B')?.dataset.drop).toBe('B');
  });
});
