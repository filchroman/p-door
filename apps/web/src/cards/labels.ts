import { cardToString, type Card, type Suit } from '@vakhta/engine';
import { ru } from '../i18n/ru';

export function rankLabel(rank: number): string {
  return ru.ranks[rank] ?? String(rank);
}

export function suitSymbol(suit: Suit): string {
  return ru.suitSymbols[suit];
}

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** Доступное имя карты: «Д♥», «10♠». */
export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

export function cardKey(card: Card): string {
  return cardToString(card);
}
