import { describe, expect, it } from 'vitest';
import { isWatchOpen, nextDeadline, pendingPlayers, VAKHTA_GRACE_MS } from '../src';
import { act, phase1State, phase2State } from './helpers';

// A: 9H, B: 7C. A тянет QD и оставляет себе (t=0), B тянет последнюю JS (t=1000).
const endOfPhase1 = () => {
  let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QD JS' });
  s = act(s, 'A', { type: 'draw' }, 0);
  s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
  return act(s, 'B', { type: 'draw' }, 1000);
};

describe('nextDeadline', () => {
  it('is null while no vakhta window can close by time', () => {
    const s = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '8C' }], deck: 'QH JD 6S' });
    expect(nextDeadline(s)).toBeNull();
    // Окно A открыто, но другие ещё не действовали — оно не закрывается по времени.
    expect(nextDeadline(act(s, 'A', { type: 'draw' }, 0))).toBeNull();
  });

  it('is the earliest grace end among windows others have acted after', () => {
    const s = endOfPhase1();
    expect(s.phase).toBe('penalty');
    expect(nextDeadline(s)).toBe(0 + VAKHTA_GRACE_MS);
    const later = act(s, 'A', { type: 'tick' }, VAKHTA_GRACE_MS);
    expect(later.phase).toBe('penalty');
    expect(nextDeadline(later)).toBe(1000 + VAKHTA_GRACE_MS);
    expect(act(later, 'A', { type: 'tick' }, 1000 + VAKHTA_GRACE_MS).phase).toBe('phase2');
  });

  it('ignores called windows and is null outside phase 1 and penalty', () => {
    const s = endOfPhase1();
    for (const w of s.watches) if (w.at === 0) w.called = true;
    expect(nextDeadline(s)).toBe(1000 + VAKHTA_GRACE_MS);
    expect(nextDeadline({ ...s, phase: 'phase2' })).toBeNull();
    expect(nextDeadline({ ...s, phase: 'over' })).toBeNull();
  });

  it('isWatchOpen is exported', () => {
    expect(isWatchOpen({ id: 1, playerId: 'A', at: 0, violated: false, called: false, othersActed: true }, VAKHTA_GRACE_MS - 1)).toBe(true);
  });
});

describe('pendingPlayers', () => {
  it('phase 1 and phase 2: the player to move', () => {
    expect(pendingPlayers(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '8C' }], deck: 'QH', turn: 'B' }))).toEqual(['B']);
    expect(pendingPlayers(phase2State({ players: [{ id: 'A', hand: '7H' }, { id: 'B', hand: '8C' }], trump: 'D', turn: 'A' }))).toEqual(['A']);
  });

  it('penalty: unique debtors with something left to give, in seat order', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '7H' }, { id: 'B', hand: '8C' }, { id: 'C', hand: '9C JD' }], trump: 'D', turn: 'A' });
    s.phase = 'penalty';
    s.debts = [
      { from: 'C', to: 'A', count: 2 },
      { from: 'A', to: 'B', count: 0 },
      { from: 'B', to: 'A', count: 1 },
      { from: 'C', to: 'B', count: 1 },
    ];
    expect(pendingPlayers(s)).toEqual(['B', 'C']);
    s.debts = [];
    expect(pendingPlayers(s)).toEqual([]);
  });

  it('over: nobody', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '7H' }, { id: 'B', hand: '8C' }], trump: 'D', turn: 'A' });
    expect(pendingPlayers({ ...s, phase: 'over' })).toEqual([]);
  });
});
