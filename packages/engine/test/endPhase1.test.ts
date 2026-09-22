import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { determineTrump } from '../src/trump';
import { act, c, cs, phase1State, pl } from './helpers';

// A: 9H, B: 7C. A тянет QD и оставляет себе, B тянет последнюю JS.
const twoCardGame = (over: { previousWinnerId?: string; foulsA?: number } = {}) => {
  let s = phase1State({
    players: [{ id: 'A', stack: '9H', fouls: over.foulsA }, { id: 'B', stack: '7C' }],
    deck: 'QD JS',
    previousWinnerId: over.previousWinnerId,
  });
  s = act(s, 'A', { type: 'draw' }, 0);
  s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
  return act(s, 'B', { type: 'draw' }, 1000);
};

describe('determineTrump', () => {
  it('uses the last card suit unless it is spades', () => {
    expect(determineTrump(c('8H'), [], [])).toBe('H');
    expect(determineTrump(c('8S'), cs('TD QS'), [])).toBe('D');
    expect(determineTrump(c('8S'), cs('QS'), cs('7H KC'))).toBe('C');
  });
});

describe('end of phase 1', () => {
  it('last card goes to the drawer, sets trump, stacks become hands', () => {
    const s = twoCardGame();
    expect(s.phase).toBe('penalty');
    expect(s.trump).toBe('D'); // JS — пика, берём предыдущую QD
    expect(s.lastCardDrawerId).toBe('B');
    expect(pl(s, 'B').hand).toEqual(cs('7C JS'));
    expect(pl(s, 'A').hand).toEqual(cs('9H QD'));
    expect(pl(s, 'A').stack).toEqual([]);
    expect(s.drawn).toBeNull();
  });

  it('waits for the vakhta grace window, then the last drawer leads', () => {
    const s = twoCardGame();
    expect(act(s, 'A', { type: 'tick' }, 3999).phase).toBe('penalty');
    const s2 = act(s, 'A', { type: 'tick' }, 4000);
    expect(s2.phase).toBe('phase2');
    expect(s2.turn).toBe('B');
  });

  it('previous game winner leads phase 2', () => {
    const s = act(twoCardGame({ previousWinnerId: 'A' }), 'A', { type: 'tick' }, 5000);
    expect(s.turn).toBe('A');
  });

  it('opponents give one chosen card per foul', () => {
    let s = twoCardGame({ foulsA: 1 });
    expect(s.debts).toEqual([{ from: 'B', to: 'A', count: 1 }]);
    expect(apply(s, 'B', { type: 'givePenalty', to: 'B', card: c('7C') }, 5000)).toEqual({ ok: false, error: 'illegal_move' });
    expect(apply(s, 'B', { type: 'givePenalty', to: 'A', card: c('AH') }, 5000)).toEqual({ ok: false, error: 'card_not_in_hand' });
    expect(act(s, 'A', { type: 'tick' }, 5000).phase).toBe('penalty');
    s = act(s, 'B', { type: 'givePenalty', to: 'A', card: c('7C') }, 5000);
    expect(pl(s, 'A').hand).toEqual(cs('9H QD 7C'));
    expect(pl(s, 'B').hand).toEqual(cs('JS'));
    expect(s.phase).toBe('phase2');
  });

  it('vakhta during the penalty phase adds debts', () => {
    // A оставляет себе TS, хотя она ложится на 9C у B; B тянет последнюю.
    let s = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }], deck: 'TS JD' });
    s = act(s, 'A', { type: 'draw' }, 0);
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
    s = act(s, 'B', { type: 'draw' }, 1000);
    expect(s.phase).toBe('penalty');
    s = act(s, 'B', { type: 'callVakhta' }, 2000);
    expect(pl(s, 'A').fouls).toBe(1);
    expect(s.debts).toEqual([{ from: 'B', to: 'A', count: 1 }]);
  });

  it('spade as the last card: trump from the previous draw, drawer still leads', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'TD 8S' });
    s = act(s, 'A', { type: 'draw' });
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }); // TD на 9H — «+1», ход продолжается
    s = act(s, 'A', { type: 'draw' });
    expect(s.trump).toBe('D');
    expect(act(s, 'A', { type: 'tick' }, 10_000).turn).toBe('A');
  });
});
