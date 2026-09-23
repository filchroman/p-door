import { describe, expect, it } from 'vitest';
import { ARC_DROP, seatArcY } from './seats';

describe('seatArcY: дуга рассадки (§2c.3)', () => {
  it('единственное место — по центру, без сдвига', () => {
    expect(seatArcY(0, 1)).toBe(0);
  });

  it('двое — симметрично и одинаково низко', () => {
    expect(seatArcY(0, 2)).toBe(ARC_DROP);
    expect(seatArcY(1, 2)).toBe(ARC_DROP);
  });

  it('центр выше краёв, а края симметричны для любого числа мест', () => {
    for (const count of [3, 4, 5]) {
      const ys = Array.from({ length: count }, (_, i) => seatArcY(i, count));
      expect(ys).toEqual([...ys].reverse());
      expect(ys[0]).toBe(ARC_DROP);
      // Нечётный ряд — центр ровно на нуле; чётный — два центральных места одинаковы и выше краёв.
      if (count % 2 === 1) expect(Math.min(...ys)).toBe(0);
      else expect(ys[count / 2 - 1]).toBeLessThan(ARC_DROP);
      for (let i = 1; i < Math.ceil(count / 2); i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
    }
  });
});
