import { describe, expect, it } from 'vitest';
import { cardToString, isPlusOne, makeDeck, nextRank, parseCard, sameCard } from '../src/cards';

describe('cards', () => {
  it('builds 36 and 52 card decks without duplicates', () => {
    for (const size of [36, 52] as const) {
      const deck = makeDeck(size);
      expect(deck).toHaveLength(size);
      expect(new Set(deck.map(cardToString)).size).toBe(size);
    }
    expect(makeDeck(36).every((c) => c.rank >= 6)).toBe(true);
  });

  it('ranks are cyclic: after Ace comes the lowest rank', () => {
    expect(nextRank(14, 36)).toBe(6);
    expect(nextRank(14, 52)).toBe(2);
    expect(nextRank(9, 36)).toBe(10);
  });

  it('isPlusOne ignores suit and wraps around', () => {
    expect(isPlusOne(parseCard('7C'), parseCard('6H'), 36)).toBe(true);
    expect(isPlusOne(parseCard('6D'), parseCard('AS'), 36)).toBe(true);
    expect(isPlusOne(parseCard('2D'), parseCard('AS'), 52)).toBe(true);
    expect(isPlusOne(parseCard('8C'), parseCard('6H'), 36)).toBe(false);
    expect(isPlusOne(parseCard('6C'), parseCard('7H'), 36)).toBe(false);
  });

  it('parses and prints cards', () => {
    expect(parseCard('TS')).toEqual({ rank: 10, suit: 'S' });
    expect(parseCard('AD')).toEqual({ rank: 14, suit: 'D' });
    expect(cardToString({ rank: 11, suit: 'H' })).toBe('JH');
    expect(() => parseCard('1X')).toThrow();
    expect(sameCard(parseCard('9H'), { rank: 9, suit: 'H' })).toBe(true);
  });
});
