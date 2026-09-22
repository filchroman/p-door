import { makeDeck, type Card, type DeckSize } from '@vakhta/engine';

/** Равномерное целое в [0, n) без перекоса по модулю. */
export function cryptoInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limit);
  return buffer[0] % n;
}

/** Фишер — Йейтс на криптографическом ГПСЧ: 32-битный seed подбирался бы по открытым картам. */
export function cryptoShuffledDeck(deckSize: DeckSize): Card[] {
  const deck = makeDeck(deckSize);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
