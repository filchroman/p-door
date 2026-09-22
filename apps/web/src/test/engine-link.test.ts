import { makeDeck } from '@vakhta/engine';
import { describe, expect, it } from 'vitest';

describe('workspace link', () => {
  it('imports the engine from TypeScript sources', () => {
    expect(makeDeck(36)).toHaveLength(36);
  });
});
