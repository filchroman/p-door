import { describe, expect, it } from 'vitest';
import { legalMoves } from '../src/legal';
import { viewFor } from '../src/view';
import { act, c, cs, phase1State, phase2State } from './helpers';

describe('viewFor', () => {
  it('shows own hand, hides other hands, prykups and the deck order', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'JH 7C', prykup: '6S 7S' }, { id: 'B', hand: 'KC', prykup: 'AS' }], trump: 'D', turn: 'A' });
    const v = viewFor(s, 'A', 0);
    expect(v.myHand).toEqual(cs('JH 7C'));
    expect(v.players).toEqual([
      { id: 'A', prykupCount: 2, stackTop: null, stackCount: 0, handCount: 2, fouls: 0, out: false },
      { id: 'B', prykupCount: 1, stackTop: null, stackCount: 0, handCount: 1, fouls: 0, out: false },
    ]);
    expect(JSON.stringify(v)).not.toContain('"prykup"');
    expect(JSON.stringify(v)).not.toContain('"hand"');
    expect('deck' in v).toBe(false);
  });

  it('shows stack tops in phase 1 and vakhta button only to others', () => {
    const s = act(phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '7C' }], deck: 'QH JD' }), 'A', { type: 'draw' });
    const vb = viewFor(s, 'B', 0);
    expect(vb.players[0].stackTop).toEqual(c('9H'));
    expect(vb.players[0].stackCount).toBe(2);
    expect(vb.drawn).toEqual(c('QH'));
    expect(vb.deckCount).toBe(1);
    expect(vb.vakhtaOpen).toBe(true);
    expect(viewFor(s, 'A', 0).vakhtaOpen).toBe(false);
  });

  it('exposes the card whose suit became trump, not the last card drawn', () => {
    // Последняя карта колоды — пика JS, козырной масть делает предыдущая QD.
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QD JS' });
    s = act(s, 'A', { type: 'draw' }, 0);
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
    s = act(s, 'B', { type: 'draw' }, 1000);
    const v = viewFor(s, 'A', 1000);
    expect(v.trump).toBe('D');
    expect(v.trumpCard).toEqual(c('QD'));
  });

  it('has no trump card before the last draw', () => {
    const v = viewFor(phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QD JS' }), 'A', 0);
    expect(v.trump).toBeNull();
    expect(v.trumpCard).toBeNull();
  });
});

describe('viewFor debts', () => {
  it('shows all outstanding debts to everyone and my own ones separately', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '7H' }, { id: 'B', hand: '8C' }, { id: 'C', hand: '9C JD' }], trump: 'D', turn: 'A' });
    s.phase = 'penalty';
    s.debts = [
      { from: 'C', to: 'A', count: 2 },
      { from: 'A', to: 'B', count: 0 },
      { from: 'B', to: 'A', count: 1 },
    ];
    const v = viewFor(s, 'A', 0);
    expect(v.debts).toEqual([
      { from: 'C', to: 'A', count: 2 },
      { from: 'B', to: 'A', count: 1 },
    ]);
    expect(v.myDebts).toEqual([]);
    expect(viewFor(s, 'C', 0).myDebts).toEqual([{ to: 'A', count: 2 }]);
    v.debts[0].count = 99;
    expect(s.debts[0].count).toBe(2);
  });
});

describe('legalMoves', () => {
  it('lists cards that beat the top, and take', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'JH 8H 6D AS' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'B']] });
    expect(legalMoves(s, 'A')).toEqual({ playable: cs('JH 6D'), canTake: true });
    expect(legalMoves(s, 'B')).toEqual({ playable: [], canTake: false });
  });

  it('any card on an empty table, no take', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'JH AS' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'A' });
    expect(legalMoves(s, 'A')).toEqual({ playable: cs('JH AS'), canTake: false });
  });
});
