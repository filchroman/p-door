export type Suit = 'C' | 'D' | 'H' | 'S';
export type DeckSize = 36 | 52;

export interface Card {
  rank: number; // 2..14, 14 = Ace
  suit: Suit;
}

export const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
const RANK_CHARS = '23456789TJQKA';

export function lowestRank(deckSize: DeckSize): number {
  return deckSize === 36 ? 6 : 2;
}

export function makeDeck(deckSize: DeckSize): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = lowestRank(deckSize); rank <= 14; rank++) deck.push({ rank, suit });
  }
  return deck;
}

export function nextRank(rank: number, deckSize: DeckSize): number {
  return rank === 14 ? lowestRank(deckSize) : rank + 1;
}

export function isPlusOne(card: Card, onto: Card, deckSize: DeckSize): boolean {
  return card.rank === nextRank(onto.rank, deckSize);
}

export function cardToString(card: Card): string {
  return RANK_CHARS[card.rank - 2] + card.suit;
}

export function parseCard(text: string): Card {
  const rank = RANK_CHARS.indexOf(text[0]) + 2;
  const suit = text[1] as Suit;
  if (text.length !== 2 || rank < 2 || !SUITS.includes(suit)) throw new Error(`bad card: ${text}`);
  return { rank, suit };
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}
