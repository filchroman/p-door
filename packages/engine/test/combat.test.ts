import { describe, expect, it } from 'vitest';
import { parseCard as c } from '../src/cards';
import { canBeat } from '../src/combat';

// Козырь — бубна (D).
const beats = (card: string, top: string, deck: 36 | 52 = 36) => canBeat(c(card), c(top), 'D', deck);

describe('canBeat', () => {
  it('same suit: only higher rank', () => {
    expect(beats('JH', '9H')).toBe(true);
    expect(beats('8H', '9H')).toBe(false);
    expect(beats('9C', '9H')).toBe(false);
  });

  it('any trump beats a non-trump non-spade', () => {
    expect(beats('6D', 'AH')).toBe(true);
    expect(beats('7D', 'KC')).toBe(true);
  });

  it('trump is beaten only by higher trump', () => {
    expect(beats('QD', 'TD')).toBe(true);
    expect(beats('9D', 'TD')).toBe(false);
    expect(beats('AH', 'TD')).toBe(false);
  });

  it('spades are isolated', () => {
    expect(beats('QS', 'TS')).toBe(true);
    expect(beats('AD', 'TS')).toBe(false); // trump does not beat spade
    expect(beats('AH', 'TS')).toBe(false);
    expect(beats('AS', '9H')).toBe(false); // spade cannot beat other suits
    expect(beats('AS', '9D')).toBe(false);
  });

  it('lowest rank beats Ace of the same suit only', () => {
    expect(beats('6H', 'AH')).toBe(true);
    expect(beats('6D', 'AD')).toBe(true);
    expect(beats('6S', 'AS')).toBe(true);
    expect(beats('2H', 'AH', 52)).toBe(true);
    expect(beats('6H', 'AC')).toBe(false);
    expect(beats('6S', 'AH')).toBe(false);
    expect(beats('AH', '6H')).toBe(true); // Ace still beats six normally
  });
});
