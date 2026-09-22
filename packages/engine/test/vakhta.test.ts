import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { act, phase1State, pl } from './helpers';

const keepViolation = () =>
  // A тянет TS и оставляет себе, хотя TS ложится на 9C у B.
  phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }, { id: 'C', stack: 'KD' }], deck: 'TS QH JD 8C' });

describe('vakhta', () => {
  it('catches keeping a card that had a +1 target', () => {
    let s = act(keepViolation(), 'A', { type: 'draw' }, 0);
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
    const r = apply(s, 'B', { type: 'callVakhta' }, 500);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pl(r.state, 'A').fouls).toBe(1);
    expect(r.events).toContainEqual({ type: 'vakhta', callerId: 'B', fouled: ['A'] });
    expect(apply(r.state, 'C', { type: 'callVakhta' }, 600)).toEqual({ ok: false, error: 'nothing_to_call' });
  });

  it('false call gives no foul and no penalty', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '8C' }, { id: 'C', stack: 'KD' }], deck: 'QH JD' });
    s = act(s, 'A', { type: 'draw' });
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' });
    const r = apply(s, 'B', { type: 'callVakhta' }, 0);
    expect(r.ok && r.events).toContainEqual({ type: 'vakhta', callerId: 'B', fouled: [] });
    expect(r.ok && pl(r.state, 'A').fouls).toBe(0);
  });

  it('catches drawing while the own top card had to be moved', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }, { id: 'C', stack: 'KD' }], deck: 'QS JD 7C' });
    s = act(s, 'A', { type: 'draw' }, 0);
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
    const r = apply(s, 'C', { type: 'callVakhta' }, 500);
    expect(r.ok && pl(r.state, 'A').fouls).toBe(1);
    expect(r.ok && r.events).toContainEqual({ type: 'vakhta', callerId: 'C', fouled: ['A'] });
  });

  it('window stays open while the violator keeps acting, no matter how long', () => {
    let s = phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }, { id: 'C', stack: 'KD' }], deck: 'QS JD 7C' });
    s = act(s, 'A', { type: 'draw' }, 0);
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 10_000);
    const r = apply(s, 'C', { type: 'callVakhta' }, 20_000);
    expect(r.ok && pl(r.state, 'A').fouls).toBe(1);
  });

  it('window closes after another player acts and 3 seconds pass', () => {
    let s = act(keepViolation(), 'A', { type: 'draw' }, 0);
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' }, 0);
    s = act(s, 'B', { type: 'draw' }, 1000);

    const early = apply(s, 'C', { type: 'callVakhta' }, 2500);
    expect(early.ok && pl(early.state, 'A').fouls).toBe(1);

    const late = apply(s, 'C', { type: 'callVakhta' }, 3500);
    // Открыто только окно B (его draw), нарушения в нём нет.
    expect(late.ok && pl(late.state, 'A').fouls).toBe(0);
    expect(late.ok && late.events).toContainEqual({ type: 'vakhta', callerId: 'C', fouled: [] });
  });

  it('a player cannot call on themselves', () => {
    let s = act(keepViolation(), 'A', { type: 'draw' });
    s = act(s, 'A', { type: 'placeDrawn', to: 'A' });
    expect(apply(s, 'A', { type: 'callVakhta' }, 0)).toEqual({ ok: false, error: 'nothing_to_call' });
  });
});
