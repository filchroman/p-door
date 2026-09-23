import { cardToString, makeDeck } from '@vakhta/engine';
import { describe, expect, it } from 'vitest';
import { cryptoInt, cryptoShuffledDeck } from '../src/shuffle';

describe('crypto shuffle', () => {
  it('returns a permutation of the full deck', () => {
    for (const size of [36, 52] as const) {
      const deck = cryptoShuffledDeck(size);
      expect(deck.map(cardToString).sort()).toEqual(makeDeck(size).map(cardToString).sort());
    }
  });

  it('differs between calls', () => {
    expect(cryptoShuffledDeck(36).map(cardToString).join()).not.toBe(cryptoShuffledDeck(36).map(cardToString).join());
  });

  it('draws integers in range', () => {
    for (let i = 0; i < 1000; i++) {
      const n = cryptoInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });
});
