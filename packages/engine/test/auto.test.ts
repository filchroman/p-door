import { describe, expect, it } from 'vitest';
import { autoAction } from '../src/auto';
import { act, c, phase1State, phase2State } from './helpers';

describe('autoAction', () => {
  it('phase 1: places drawn card on an opponent first', () => {
    const s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '9C' }], deck: 'QH', drawn: 'TS' });
    expect(autoAction(s, 'A')).toEqual({ type: 'placeDrawn', to: 'B' });
  });

  it('phase 1: keeps the drawn card when there is no opponent target', () => {
    const s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QH', drawn: 'QS' });
    expect(autoAction(s, 'A')).toEqual({ type: 'placeDrawn', to: 'A' });
  });

  it('phase 1: moves own top when required, otherwise draws', () => {
    const must = phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }], deck: 'QH JD' });
    expect(autoAction(must, 'A')).toEqual({ type: 'moveOwnTop', to: 'B' });
    const plain = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '8D' }], deck: 'QH JD' });
    expect(autoAction(plain, 'A')).toEqual({ type: 'draw' });
    expect(autoAction(plain, 'B')).toBeNull();
  });

  it('penalty: gives a random card to the offender', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '9H', fouls: 1 }, { id: 'B', stack: '7C' }], deck: 'QD JS' });
    s = act(s, 'A', { type: 'draw' });
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' });
    s = act(s, 'B', { type: 'draw' });
    expect(autoAction(s, 'B', () => 0)).toEqual({ type: 'givePenalty', to: 'A', card: c('7C') });
    expect(autoAction(s, 'A')).toBeNull();
  });

  it('phase 2: takes on a non-empty table, leads the lowest non-trump otherwise', () => {
    const table = phase2State({ players: [{ id: 'A', hand: 'JH' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'B']] });
    expect(autoAction(table, 'A')).toEqual({ type: 'take' });
    const lead = phase2State({ players: [{ id: 'A', hand: 'AH 7C 6D' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'A' });
    expect(autoAction(lead, 'A')).toEqual({ type: 'play', card: c('7C') });
    const allTrump = phase2State({ players: [{ id: 'A', hand: 'AD 6D' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'A' });
    expect(autoAction(allTrump, 'A')).toEqual({ type: 'play', card: c('6D') });
  });
});
