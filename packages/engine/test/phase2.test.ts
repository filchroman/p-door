import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import type { StallRule } from '../src/types';
import { act, c, cs, phase2State, pl } from './helpers';

// Козырь — бубна. Места: A → B → C → A.
describe('phase 2: beating and taking', () => {
  it('any card leads on an empty table', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '7S 9C' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A' }), 'A', { type: 'play', card: c('7S') });
    expect(s.table).toEqual([{ card: c('7S'), by: 'A' }]);
    expect(s.turn).toBe('B');
  });

  it('beating follows combat rules', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '7C' }, { id: 'B', hand: 'JH 8H 6D AS' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'B', table: [['9H', 'A']] });
    expect(apply(s, 'B', { type: 'play', card: c('8H') }, 0)).toEqual({ ok: false, error: 'illegal_move' });
    expect(apply(s, 'B', { type: 'play', card: c('AS') }, 0)).toEqual({ ok: false, error: 'illegal_move' });
    expect(apply(s, 'B', { type: 'play', card: c('QC') }, 0)).toEqual({ ok: false, error: 'card_not_in_hand' });
    expect(act(s, 'B', { type: 'play', card: c('6D') }).turn).toBe('C');
    const s2 = act(s, 'B', { type: 'play', card: c('JH') });
    expect(s2.table.map((t) => t.card)).toEqual(cs('9H JH'));
  });

  it('take moves the bottom card to hand; next player beats the same top', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] }), 'C', { type: 'take' });
    expect(pl(s, 'C').hand).toEqual(cs('KC 7H'));
    expect(s.table.map((t) => t.card)).toEqual(cs('9H'));
    expect(s.turn).toBe('A');
  });

  it('take is always allowed on a non-empty table and forbidden on an empty one', () => {
    const empty = phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }], trump: 'D', turn: 'A' });
    expect(apply(empty, 'A', { type: 'take' }, 0)).toEqual({ ok: false, error: 'illegal_move' });
  });

  it('table emptied by takes: the next player leads with any card', () => {
    let s = phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }, { id: 'C', hand: 'KC 6S' }], trump: 'D', turn: 'B', table: [['7H', 'A']] });
    s = act(s, 'B', { type: 'take' });
    expect(s.table).toEqual([]);
    expect(s.turn).toBe('C');
    s = act(s, 'C', { type: 'play', card: c('6S') });
    expect(s.turn).toBe('A');
  });

  it('players who are out are skipped', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '', out: true }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A' }), 'A', { type: 'play', card: c('QH') });
    expect(s.turn).toBe('C');
  });

  it('rejects out-of-turn and phase-1 actions', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }], trump: 'D', turn: 'A' });
    expect(apply(s, 'B', { type: 'play', card: c('8C') }, 0)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(apply(s, 'A', { type: 'draw' }, 0)).toEqual({ ok: false, error: 'wrong_phase' });
  });
});

describe('phase 2: vidbiy, prykup, exit', () => {
  it('vidbiy clears the table when it holds as many cards as active players; closer leads', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '8C' }, { id: 'B', hand: 'QC' }, { id: 'C', hand: 'JH KC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] }), 'C', { type: 'play', card: c('JH') });
    expect(s.table).toEqual([]);
    expect(s.discard).toHaveLength(3);
    expect(s.turn).toBe('C');
  });

  it('empty-handed waiting players still count; their prykup opens at vidbiy', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '', prykup: '6S 7S' }, { id: 'B', hand: 'JH QC' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'B', table: [['9H', 'A']] });
    s = act(s, 'B', { type: 'play', card: c('JH') });
    expect(s.table).toHaveLength(2);
    s = act(s, 'C', { type: 'play', card: c('KH') });
    expect(s.table).toEqual([]);
    expect(pl(s, 'A').hand).toEqual(cs('6S 7S'));
    expect(pl(s, 'A').prykup).toEqual([]);
    expect(s.turn).toBe('C');
  });

  it('empty hand and no prykup at vidbiy means the player is out', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: 'JH QC' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'B', table: [['9H', 'A']] });
    s = act(s, 'B', { type: 'play', card: c('JH') });
    s = act(s, 'C', { type: 'play', card: c('KH') });
    expect(pl(s, 'A').out).toBe(true);
    expect(s.outOrder).toEqual(['A']);
    expect(s.phase).toBe('phase2');
    expect(s.turn).toBe('C');
  });

  it('if the closer goes out, the next active player leads; vidbiy size shrinks', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '7C' }, { id: 'B', hand: '8C' }, { id: 'C', hand: 'JH' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] });
    s = act(s, 'C', { type: 'play', card: c('JH') });
    expect(pl(s, 'C').out).toBe(true);
    expect(s.turn).toBe('A');
    s = act(s, 'A', { type: 'play', card: c('7C') });
    s = act(s, 'B', { type: 'play', card: c('8C') }); // 2 карты = 2 активных → отбой
    // Обе руки пусты, прикупов нет → оба выходят одновременно → ничья.
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: null, winnerId: 'C', outOrder: ['C', 'B', 'A'], technical: false });
  });

  it('empty hand with cards on the table: the player must take', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '', prykup: '6S' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'C']] });
    const s2 = act(s, 'A', { type: 'take' });
    expect(pl(s2, 'A').hand).toEqual(cs('9H'));
    expect(pl(s2, 'A').prykup).toEqual(cs('6S'));
    expect(s2.turn).toBe('B');
  });

  it('empty hand and empty table on your turn counts as vidbiy: prykup opens', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '', prykup: '6S 7S' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'C', table: [['9H', 'B']] }), 'C', { type: 'take' });
    expect(s.turn).toBe('A');
    expect(pl(s, 'A').hand).toEqual(cs('6S 7S'));
  });

  it('empty hand, empty table, no prykup: the player is out and the next one leads', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'C', table: [['9H', 'B']] }), 'C', { type: 'take' });
    expect(pl(s, 'A').out).toBe(true);
    expect(s.turn).toBe('B');
  });
});

describe('phase 2: game over', () => {
  it('the last player with cards loses; first out wins', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'JH' }, { id: 'B', hand: 'KC 8D' }], trump: 'D', turn: 'A', table: [['9H', 'B']] }), 'A', { type: 'play', card: c('JH') });
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'B', winnerId: 'A', outOrder: ['A'], technical: false });
    expect(apply(s, 'B', { type: 'take' }, 0)).toEqual({ ok: false, error: 'wrong_phase' });
  });

  it('several exits at one vidbiy: order goes clockwise from the closer', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: '' }, { id: 'C', hand: 'KH QC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] }), 'C', { type: 'play', card: c('KH') });
    expect(s.result).toEqual({ loserId: 'C', winnerId: 'A', outOrder: ['A', 'B'], technical: false });
  });

  it('surrender ends the game with a technical loss', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'JH' }, { id: 'B', hand: 'KC' }, { id: 'C', hand: '8C' }], trump: 'D', turn: 'A' }), 'B', { type: 'surrender' });
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'B', winnerId: null, outOrder: [], technical: true });
  });
});

describe('phase 2: stalled battle', () => {
  // Трое активных, козырь ♥, никто не может побить: заходы и взятия чередуются бесконечно.
  const trap = (stallRule?: StallRule) =>
    phase2State({ players: [{ id: 'A', hand: '3C' }, { id: 'B', hand: '' }, { id: 'C', hand: '2C' }], trump: 'H', turn: 'A', deckSize: 52, stallRule });

  const runTrap = (stallRule?: StallRule) => {
    let s = trap(stallRule);
    s = act(s, 'A', { type: 'play', card: c('3C') });
    s = act(s, 'B', { type: 'take' });
    s = act(s, 'C', { type: 'play', card: c('2C') });
    s = act(s, 'A', { type: 'take' });
    s = act(s, 'B', { type: 'play', card: c('3C') });
    expect(s.quietActions).toBe(5);
    return apply(s, 'C', { type: 'take' }, 0);
  };

  it('two full circles without a beat force a vidbiy by default', () => {
    const r = runTrap();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual({ type: 'stall', rule: 'forcedVidbiy' });
    expect(pl(r.state, 'B').out).toBe(true);
    expect(r.state.outOrder).toEqual(['B']);
    expect(r.state.phase).toBe('phase2');
    expect(r.state.turn).toBe('C');
    expect(r.state.quietActions).toBe(0);
  });

  it('endGame rule: the player with most cards loses, ties go clockwise from the player to move', () => {
    const r = runTrap('endGame');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual({ type: 'stall', rule: 'endGame' });
    expect(r.state.phase).toBe('over');
    expect(r.state.result).toEqual({ loserId: 'A', winnerId: null, outOrder: [], technical: false });
  });

  it('a beat resets the counter; leads and takes increase it', () => {
    const s0 = phase2State({ players: [{ id: 'A', hand: 'JH 7C' }, { id: 'B', hand: 'QH' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'C']] });
    s0.quietActions = 4;
    expect(act(s0, 'A', { type: 'play', card: c('JH') }).quietActions).toBe(0);
    const taken = apply(s0, 'A', { type: 'take' }, 0);
    expect(taken.ok && taken.state.quietActions).toBe(5);
    expect(taken.ok && taken.events.some((e) => e.type === 'stall')).toBe(false);
    const lead = phase2State({ players: [{ id: 'A', hand: '7C' }, { id: 'B', hand: 'QH' }], trump: 'D', turn: 'A' });
    expect(act(lead, 'A', { type: 'play', card: c('7C') }).quietActions).toBe(1);
  });

  it('a forced vidbiy that changes nothing ends the game by card count', () => {
    // Козырь ♦, у всех разные масти без козырей: побить невозможно, и пустой руки на пустом столе не бывает.
    let s = phase2State({ players: [{ id: 'A', hand: '2S' }, { id: 'B', hand: '4C' }, { id: 'C', hand: '7H' }], trump: 'D', turn: 'A', deckSize: 52 });
    s = act(s, 'A', { type: 'play', card: c('2S') });
    s = act(s, 'B', { type: 'take' });
    s = act(s, 'C', { type: 'play', card: c('7H') });
    s = act(s, 'A', { type: 'take' });
    s = act(s, 'B', { type: 'play', card: c('4C') });
    const r = apply(s, 'C', { type: 'take' }, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual({ type: 'stall', rule: 'forcedVidbiy' });
    expect(r.state.phase).toBe('over');
    expect(r.state.result).toEqual({ loserId: 'A', winnerId: null, outOrder: [], technical: false });
  });

  it('an exit through an empty hand on an empty table resets the counters', () => {
    const s0 = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'C', table: [['9H', 'B']] });
    s0.quietActions = 3;
    s0.idleActions = 3;
    const r = apply(s0, 'C', { type: 'take' }, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pl(r.state, 'A').out).toBe(true);
    expect(r.state.quietActions).toBe(0);
    expect(r.state.idleActions).toBe(0);
    expect(r.events.some((e) => e.type === 'stall')).toBe(false);
  });

  it('ten circles without progress trigger the stall rule even with beats', () => {
    const s0 = phase2State({ players: [{ id: 'A', hand: 'JH' }, { id: 'B', hand: 'QH' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'C']] });
    s0.idleActions = 10 * 3 - 1;
    const r = apply(s0, 'A', { type: 'play', card: c('JH') }, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual({ type: 'stall', rule: 'forcedVidbiy' });
    expect(r.state.table).toEqual([]);
    expect(r.state.discard).toHaveLength(2);
    expect(r.state.idleActions).toBe(0);
    expect(r.state.phase).toBe('phase2');
  });
});
