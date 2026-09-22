export const FAN_WIDTH_OPPONENT = 96;
const NATURAL_OVERLAP = 0.35;

/** Перекрытие соседних карт веера (px): N карт всегда влезают в maxWidth, элементов остаётся ровно N. */
export function fanOverlap(count: number, cardWidth: number, maxWidth: number): number {
  if (count <= 1) return 0;
  const natural = cardWidth * NATURAL_OVERLAP;
  const needed = (count * cardWidth - maxWidth) / (count - 1);
  return Math.min(cardWidth - 1, Math.max(natural, needed));
}
