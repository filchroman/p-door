import { cardToString, makeDeck } from '@vakhta/engine';
import { describe, expect, it } from 'vitest';
import { ATLAS, CLOTH_SVG, retryDelayMs, sha1Hex } from './atlas';

const RANK_WORDS: Record<string, string> = { T: '10', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
const SUIT_WORDS: Record<string, string> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };

describe('Atlas deck manifest', () => {
  it('covers the whole 52-card deck and one back, once each', () => {
    expect(ATLAS).toHaveLength(53);
    expect(ATLAS.map((e) => e.code).sort()).toEqual([...makeDeck(52).map(cardToString), 'back'].sort());
  });

  it('names face files exactly as on Commons', () => {
    for (const e of ATLAS.filter((x) => x.code !== 'back')) {
      expect(e.file).toBe(`Atlas deck ${RANK_WORDS[e.code[0]] ?? e.code[0]} of ${SUIT_WORDS[e.code[1]]}.svg`);
    }
    expect(ATLAS.find((x) => x.code === 'back')!.file).toBe('Atlas deck card back blue and brown.svg');
  });

  it('pins every file to an upload URL and a sha1', () => {
    for (const e of ATLAS) {
      expect(e.url).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\//);
      expect(e.url.endsWith(`/${e.file.replaceAll(' ', '_')}`)).toBe(true);
      expect(e.sha1).toMatch(/^[0-9a-f]{40}$/);
    }
    expect(new Set(ATLAS.map((e) => e.sha1)).size).toBe(53);
  });

  it('computes sha1 and polite retry delays', () => {
    expect(sha1Hex(new TextEncoder().encode('abc'))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(retryDelayMs(0, '7')).toBe(7000);
    expect(retryDelayMs(0, null)).toBe(5000);
    expect(retryDelayMs(2, null)).toBe(20_000);
    expect(retryDelayMs(10, 'soon')).toBe(60_000);
  });

  it('bakes the cloth noise in user space (otherwise librsvg renders an empty tile)', () => {
    expect(CLOTH_SVG).toContain('filterUnits="userSpaceOnUse"');
    expect(CLOTH_SVG).toContain('feTurbulence');
  });
});
