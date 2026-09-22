import type { Card, Suit } from './cards';

/** Масть козыря и карта, чья масть ею стала (её показывает значок козыря). */
export interface TrumpChoice {
  suit: Suit;
  card: Card | null;
}

/** Пика никогда не козырь: ищем ближайшую предыдущую непиковую карту. */
export function determineTrump(last: Card, earlierDraws: Card[], openDeal: Card[]): TrumpChoice {
  if (last.suit !== 'S') return { suit: last.suit, card: last };
  for (let i = earlierDraws.length - 1; i >= 0; i--) if (earlierDraws[i].suit !== 'S') return { suit: earlierDraws[i].suit, card: earlierDraws[i] };
  for (let i = openDeal.length - 1; i >= 0; i--) if (openDeal[i].suit !== 'S') return { suit: openDeal[i].suit, card: openDeal[i] };
  return { suit: 'H', card: null };
}
