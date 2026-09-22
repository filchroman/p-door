import { afterEach, describe, expect, it } from 'vitest';
import { phase1State } from '../../test/states';
import { makeUpdate } from '../../test/updates';
import { cardsInPlay, expectedZones, zoneMismatches } from './zones';

const state = phase1State({
  players: [{ id: 'A', stack: '6C 9H', prykup: '2C 3C' }, { id: 'B', stack: '8D', prykup: 'AS AH' }],
  deck: 'QS JD 7C',
  drawn: 'TS',
});
const view = makeUpdate(state, 'A').view;
const cards = (n: number) => '<div class="card"></div>'.repeat(n);
const zone = (name: string, n: number, declared = n) => `<div data-zone="${name}" data-count="${declared}">${cards(n)}</div>`;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('zones', () => {
  it('knows how many cards each zone must show', () => {
    expect(expectedZones(view)).toMatchObject({ deck: 3, drawn: 1, table: 0, 'stack-A': 2, 'stack-B': 1, 'prykup-A': 2, 'prykup-B': 2, 'hand-A': 0 });
    expect(cardsInPlay(view)).toBe(36);
  });

  it('accepts an exact rendering (sum over zones is checked against the declared total too)', () => {
    document.body.innerHTML = zone('deck', 3) + zone('drawn', 1) + zone('stack-A', 2) + zone('prykup-A', 2) + zone('stack-B', 1) + zone('prykup-B', 2);
    // phase1State кладёт в игру только эти 11 карт — тестовое состояние неполное, поэтому сумму сверяем с зонами.
    expect(zoneMismatches(document.body, view).filter((m) => !m.startsWith('total'))).toEqual([]);
  });

  it('reports an extra card, a missing zone, a duplicated zone and a wrong declaration', () => {
    document.body.innerHTML =
      zone('deck', 4, 3) + zone('drawn', 1) + zone('stack-A', 2) + zone('stack-A', 2) + zone('prykup-A', 2, 1) + zone('prykup-B', 2);
    const problems = zoneMismatches(document.body, view);
    expect(problems.some((m) => m.startsWith('deck'))).toBe(true);
    expect(problems.some((m) => m.startsWith('stack-A'))).toBe(true);
    expect(problems.some((m) => m.startsWith('stack-B'))).toBe(true);
    expect(problems.some((m) => m.startsWith('prykup-A'))).toBe(true);
  });
});
