import { legalMoves } from '@vakhta/engine';
import { describe, expect, it } from 'vitest';
import { phase1State, phase2State } from '../../test/states';
import { makeUpdate } from '../../test/updates';
import { legalFromView } from './legal';

describe('legalFromView', () => {
  const cases = [
    phase2State({ players: [{ id: 'A', hand: 'QH 7C 6D AS' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'B']] }),
    phase2State({ players: [{ id: 'A', hand: '6S 7S AH' }, { id: 'B', hand: 'KC' }], trump: 'H', turn: 'A', table: [['AS', 'B']] }),
    phase2State({ players: [{ id: 'A', hand: '6S 7S' }, { id: 'B', hand: 'KC' }], trump: 'H', turn: 'A' }),
    phase2State({ players: [{ id: 'A', hand: '6S 7S' }, { id: 'B', hand: 'KC' }], trump: 'H', turn: 'B', table: [['8C', 'B']] }),
  ];

  it('matches the engine legalMoves for my seat', () => {
    for (const state of cases) expect(legalFromView(makeUpdate(state, 'A').view)).toEqual(legalMoves(state, 'A'));
  });

  it('allows nothing outside phase 2', () => {
    const p1 = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }], deck: 'KD' });
    expect(legalFromView(makeUpdate(p1, 'A').view)).toEqual({ playable: [], canTake: false });
  });
});
