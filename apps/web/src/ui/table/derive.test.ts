import { describe, expect, it } from 'vitest';
import { emptyMarks } from '../../store/derive';
import { penaltyState, phase1State, phase2State } from '../../test/states';
import { makeUpdate } from '../../test/updates';
import { activeCount, opponentsOf, playerStatus } from './derive';
import { fanOverlap } from './fan';

const p2 = phase2State({
  players: [{ id: 'A', hand: '6C' }, { id: 'B', hand: '7C' }, { id: 'C', hand: '', out: true }, { id: 'D', hand: '' }],
  trump: 'H',
  turn: 'B',
  table: [['9H', 'A']],
});

describe('table derive', () => {
  it('seats opponents clockwise after me', () => {
    expect(opponentsOf(makeUpdate(p2, 'A').view).map((p) => p.id)).toEqual(['B', 'C', 'D']);
    expect(opponentsOf(makeUpdate(p2, 'C').view).map((p) => p.id)).toEqual(['D', 'A', 'B']);
  });

  it('counts active players', () => {
    expect(activeCount(makeUpdate(p2, 'A').view)).toBe(3);
  });

  it('derives the status plaque', () => {
    const view = makeUpdate(p2, 'A').view;
    const marks = { ...emptyMarks(1), acts: { A: 'took' as const, D: 'beat' as const } };
    expect(playerStatus(view, 'B', marks)).toBe('turn');
    expect(playerStatus(view, 'C', marks)).toBe('out');
    expect(playerStatus(view, 'D', marks)).toBe('waiting');
    expect(playerStatus(view, 'A', marks)).toBe('taking');
    expect(playerStatus(view, 'A', { ...marks, acts: { A: 'beat' } })).toBe('beating');
    expect(playerStatus(view, 'B', { ...marks, vakhtaBy: 'B' })).toBe('vakhta');
    expect(playerStatus(view, 'B', { ...marks, vakhtaBy: 'B', vakhtaCaught: true })).toBe('caught');
    expect(playerStatus(view, 'Z', marks)).toBeNull();
  });

  it('shows no turn plaque during the penalty', () => {
    const s = penaltyState({ players: [{ id: 'A', hand: '6C' }, { id: 'B', hand: '7C' }], trump: 'H' });
    expect(playerStatus(makeUpdate(s, 'A').view, 'A', emptyMarks(1))).toBeNull();
    const p1 = phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C' }], deck: 'KD' });
    expect(playerStatus(makeUpdate(p1, 'B').view, 'A', emptyMarks(1))).toBe('turn');
  });

  it('compresses a fan so that N cards always fit', () => {
    expect(fanOverlap(0, 26, 96)).toBe(0);
    expect(fanOverlap(1, 26, 96)).toBe(0);
    expect(fanOverlap(3, 26, 96)).toBeCloseTo(26 * 0.35);
    const n = 33;
    const overlap = fanOverlap(n, 26, 96);
    expect(26 + (n - 1) * (26 - overlap)).toBeLessThanOrEqual(96.01);
    expect(overlap).toBeLessThan(26);
  });
});
