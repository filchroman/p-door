import { lowestRank, type Card, type DeckSize, type Suit } from './cards';

export function rankBeats(attacker: number, defender: number, deckSize: DeckSize): boolean {
  if (attacker === lowestRank(deckSize) && defender === 14) return true;
  return attacker > defender;
}

export function canBeat(card: Card, top: Card, trump: Suit, deckSize: DeckSize): boolean {
  const sameSuit = card.suit === top.suit;
  if (top.suit === 'S') return sameSuit && rankBeats(card.rank, top.rank, deckSize);
  if (card.suit === 'S') return false;
  if (sameSuit) return rankBeats(card.rank, top.rank, deckSize);
  return card.suit === trump;
}
