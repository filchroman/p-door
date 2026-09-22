import { describe, expect, it } from 'vitest';
import { newSession, nextDealer, prykupSize, recordResult, setupNextGame, vakhterVechora, type SessionState } from '../src/session';
import type { GameResult } from '../src/types';

const lost = (loserId: string | null, winnerId: string | null = null): GameResult => ({ loserId, winnerId, outOrder: [], technical: false });
const play = (...results: GameResult[]): SessionState => results.reduce(recordResult, newSession());

describe('session', () => {
  it('prykup grows by one for every loss in the session', () => {
    const se = play(lost('A', 'B'), lost('B', 'A'), lost('A', 'B'));
    expect(prykupSize(se, 'A')).toBe(4);
    expect(prykupSize(se, 'B')).toBe(3);
    expect(prykupSize(se, 'C')).toBe(2);
  });

  it('a draw changes no losses but updates the winner', () => {
    const se = play(lost('A', 'B'), lost(null, 'C'));
    expect(se.losses).toEqual({ A: 1 });
    expect(se.lastWinnerId).toBe('C');
  });

  it('the last loser deals; random if absent or none yet', () => {
    expect(nextDealer(play(lost('B'), lost(null)), ['A', 'B', 'C'], () => 0.99)).toBe('B');
    expect(nextDealer(play(lost('Z')), ['A', 'B', 'C'], () => 0)).toBe('A');
    expect(nextDealer(newSession(), ['A', 'B', 'C'], () => 0.5)).toBe('B');
  });

  it('vakhter of the evening: most losses, tie goes to the latest loser', () => {
    expect(vakhterVechora(newSession())).toBeNull();
    expect(vakhterVechora(play(lost('A'), lost('B'), lost('A')))).toBe('A');
    expect(vakhterVechora(play(lost('A'), lost('B'), lost('A'), lost('B')))).toBe('B');
    expect(vakhterVechora(play(lost('B'), lost('A'), lost('A'), lost('B'), lost('C')))).toBe('B');
  });

  it('setupNextGame fills prykup sizes, dealer and previous winner', () => {
    const se = play(lost('A', 'C'));
    const setup = setupNextGame(se, ['A', 'B', 'C'], 36, 9);
    expect(setup.prykupSizes).toEqual({ A: 3, B: 2, C: 2 });
    expect(setup.dealerId).toBe('A');
    expect(setup.previousWinnerId).toBe('C');
    expect(setupNextGame(se, ['A', 'B'], 36, 9).previousWinnerId).toBeNull();
  });
});
