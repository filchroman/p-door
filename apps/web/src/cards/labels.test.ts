import { describe, expect, it } from 'vitest';
import { cardKey, cardLabel, isRed, rankLabel } from './labels';

describe('card labels', () => {
  it('uses Russian indices', () => {
    expect([2, 6, 9, 10, 11, 12, 13, 14].map(rankLabel)).toEqual(['2', '6', '9', '10', 'В', 'Д', 'К', 'Т']);
  });

  it('builds accessible names and keys', () => {
    expect(cardLabel({ rank: 12, suit: 'H' })).toBe('Д♥');
    expect(cardLabel({ rank: 10, suit: 'S' })).toBe('10♠');
    expect(cardKey({ rank: 10, suit: 'S' })).toBe('TS');
  });

  it('knows red suits', () => {
    expect(isRed('H') && isRed('D')).toBe(true);
    expect(isRed('C') || isRed('S')).toBe(false);
  });
});
