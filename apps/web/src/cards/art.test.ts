import { cardToString, makeDeck } from '@vakhta/engine';
import { describe, expect, it } from 'vitest';
import { ART_URLS, BACK_URL, faceUrl } from './art';

describe('card art', () => {
  it('maps every rank and suit to an existing WebP file', () => {
    for (const card of makeDeck(52)) expect(faceUrl(card)).toMatch(new RegExp(`/${cardToString(card)}\\.webp`));
  });

  it('has the back and nothing else', () => {
    expect(BACK_URL).toMatch(/\/back\.webp/);
    expect(Object.keys(ART_URLS)).toHaveLength(53);
  });

  it('refuses a card that is not in the deck', () => {
    expect(() => faceUrl({ rank: 15, suit: 'H' })).toThrow();
  });
});
