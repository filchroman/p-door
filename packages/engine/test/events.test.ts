import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import type { ApplyResult } from '../src/types';
import { act, c, phase1State, phase2State } from './helpers';

const eventsOf = (r: ApplyResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.events;
};

// Полный массив событий для stall → принудительный отбой → конец партии проверяется
// в phase2.test.ts ('a no-beat trap without an empty hand').
describe('full event sequences', () => {
  it('the last draw of phase 1, then the tick into phase 2', () => {
    // A: 9H, B: 7C. A тянет QD и оставляет себе, B тянет последнюю JS (пика → козырь по QD).
    let s = phase1State({ players: [{ id: 'A', stack: '9H' }, { id: 'B', stack: '7C' }], deck: 'QD JS' });
    s = act(s, 'A', { type: 'draw' }, 0);
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
    const last = apply(s, 'B', { type: 'draw' }, 1000);
    expect(eventsOf(last)).toEqual([
      { type: 'drew', playerId: 'B', card: c('JS') },
      { type: 'trump', suit: 'D', card: c('JS') },
      { type: 'phase', phase: 'penalty' },
    ]);
    if (!last.ok) return;
    // Окно B (t=1000) закрывается в 4000; первым ходит вытянувший последнюю карту.
    const tick = apply(last.state, 'A', { type: 'tick' }, 4000);
    expect(eventsOf(tick)).toEqual([{ type: 'phase', phase: 'phase2' }]);
    expect(tick.ok && tick.state.turn).toBe('B');
  });

  it('a vidbiy where two players go out and the game ends', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: '' }, { id: 'C', hand: 'KH QC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] });
    const result = { loserId: 'C', winnerId: 'A', outOrder: ['A', 'B'], technical: false };
    expect(eventsOf(apply(s, 'C', { type: 'play', card: c('KH') }, 0))).toEqual([
      { type: 'played', playerId: 'C', card: c('KH') },
      { type: 'vidbiy', closerId: 'C' },
      { type: 'out', playerId: 'A' },
      { type: 'out', playerId: 'B' },
      { type: 'gameOver', result },
    ]);
  });
});
