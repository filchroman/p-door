import type { Card, Suit } from './cards';

/** Пика никогда не козырь: ищем ближайшую предыдущую непиковую карту. */
export function determineTrump(last: Card, earlierDraws: Card[], openDeal: Card[]): Suit {
  if (last.suit !== 'S') return last.suit;
  for (let i = earlierDraws.length - 1; i >= 0; i--) if (earlierDraws[i].suit !== 'S') return earlierDraws[i].suit;
  for (let i = openDeal.length - 1; i >= 0; i--) if (openDeal[i].suit !== 'S') return openDeal[i].suit;
  return 'H';
}
