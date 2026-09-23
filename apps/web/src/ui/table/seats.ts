/**
 * Рассадка соперников по верхней дуге стола (спека §2c.3): все в одном ряду, симметрично,
 * крайние места чуть ниже центральных. Ни переносов на вторую строку, ни «кривых» позиций.
 */

/** На сколько ниже центра сидит самое крайнее место (px). */
export const ARC_DROP = 14;

/** Сдвиг вниз i-го из count мест: 0 в центре, ARC_DROP по краям, симметрично относительно центра. */
export function seatArcY(index: number, count: number): number {
  if (count <= 1) return 0;
  const half = (count - 1) / 2;
  const t = (index - half) / half;
  return Math.round(ARC_DROP * t * t);
}
