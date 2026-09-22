import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { act, c, phase1State, pl, top } from './helpers';

describe('phase 1 turn', () => {
  it('draw puts the card into the drawn slot, turn stays', () => {
    const s = act(phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QH JD' }), 'A', { type: 'draw' });
    expect(s.drawn).toEqual(c('QH'));
    expect(s.deck).toHaveLength(1);
    expect(s.turn).toBe('A');
  });

  it('does not mutate the input state', () => {
    const s0 = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QH JD' });
    const copy = structuredClone(s0);
    act(s0, 'A', { type: 'draw' });
    expect(s0).toEqual(copy);
  });

  it('+1 onto an opponent continues the turn', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '9C' }], deck: 'TS QH' });
    s = act(s, 'A', { type: 'draw' });
    s = act(s, 'A', { type: 'placeDrawn', to: 'B' });
    expect(top(s, 'B')).toEqual(c('TS'));
    expect(s.drawn).toBeNull();
    expect(s.turn).toBe('A');
  });

  it('+1 chain on own stack continues the turn', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'TS JC QD 7D' });
    for (let i = 0; i < 3; i++) {
      s = act(s, 'A', { type: 'draw' });
      s = act(s, 'A', { type: 'placeDrawn', to: 'A' });
    }
    expect(top(s, 'A')).toEqual(c('QD'));
    expect(s.turn).toBe('A');
  });

  it('+1 wraps from Ace to six', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: 'AS' }], deck: '6D QH' });
    s = act(s, 'A', { type: 'draw' });
    s = act(s, 'A', { type: 'placeDrawn', to: 'B' });
    expect(top(s, 'B')).toEqual(c('6D'));
  });

  it('non-+1 onto an opponent is illegal', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QH JD' });
    s = act(s, 'A', { type: 'draw' });
    expect(apply(s, 'A', { type: 'placeDrawn', to: 'B' }, 0)).toEqual({ ok: false, error: 'illegal_move' });
  });

  it('keeping a non-+1 card ends the turn', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }, { id: 'C', stack: 'KD' }], deck: 'QH JD' });
    s = act(s, 'A', { type: 'draw' });
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' });
    expect(top(s, 'A')).toEqual(c('QH'));
    expect(s.turn).toBe('B');
  });

  it('own top card can be moved onto an opponent when the stack has 2+ cards', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }], deck: 'QH JD' });
    s = act(s, 'A', { type: 'moveOwnTop', to: 'B' });
    expect(top(s, 'A')).toEqual(c('6C'));
    expect(top(s, 'B')).toEqual(c('9H'));
    expect(s.turn).toBe('A');
  });

  it('single own card cannot be moved; non-+1 move is illegal', () => {
    const single = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '8D' }], deck: 'QH JD' });
    expect(apply(single, 'A', { type: 'moveOwnTop', to: 'B' }, 0)).toEqual({ ok: false, error: 'illegal_move' });
    const wrong = phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '7D' }], deck: 'QH JD' });
    expect(apply(wrong, 'A', { type: 'moveOwnTop', to: 'B' }, 0)).toEqual({ ok: false, error: 'illegal_move' });
  });

  it('rejects out-of-turn actions, double draw and unknown players', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QH JD' });
    expect(apply(s, 'B', { type: 'draw' }, 0)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(apply(s, 'Z', { type: 'draw' }, 0)).toEqual({ ok: false, error: 'unknown_player' });
    expect(apply(s, 'A', { type: 'take' }, 0)).toEqual({ ok: false, error: 'wrong_phase' });
    s = act(s, 'A', { type: 'draw' });
    expect(apply(s, 'A', { type: 'draw' }, 0)).toEqual({ ok: false, error: 'illegal_move' });
    expect(pl(s, 'A').stack).toHaveLength(1);
  });
});
