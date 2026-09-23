import { afterEach, describe, expect, it } from 'vitest';
import { phase1State } from '../../test/states';
import { makeUpdate } from '../../test/updates';
import { DECK_CAP, FAN_CAP, PRYKUP_CAP, STACK_CAP, cardsInPlay, cardsShown, expectedZones, renderedZones, zoneLimit, zoneMismatches } from './zones';

const state = phase1State({
  players: [{ id: 'A', stack: '6C 9H', prykup: '2C 3C' }, { id: 'B', stack: '8D', prykup: 'AS AH' }],
  deck: 'QS JD 7C',
  drawn: 'TS',
});
const view = makeUpdate(state, 'A').view;
const cards = (n: number) => '<div class="card"></div>'.repeat(n);
const zone = (name: string, n: number, declared = n, shown = n) =>
  `<div data-zone="${name}" data-count="${declared}" data-shown="${shown}">${cards(n)}</div>`;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('zones', () => {
  it('knows how many cards each zone must show', () => {
    expect(expectedZones(view)).toMatchObject({ deck: 3, drawn: 1, table: 0, 'stack-A': 2, 'stack-B': 1, 'prykup-A': 2, 'prykup-B': 2, 'hand-A': 0 });
    expect(cardsInPlay(view)).toBe(36);
  });

  it('caps what is drawn but never the number (§2c.2)', () => {
    const crowded = makeUpdate(
      phase1State({
        players: [{ id: 'A', stack: '6C 9H 7D 8D TD JD QD KD', prykup: '2C 3C 4C 5C' }, { id: 'B', stack: '8D', prykup: 'AS AH' }],
        deck: 'QS JD 7C 2H 3H 4H 5H 6H 7H 8H 9H TH',
        drawn: 'TS',
      }),
      'A',
    ).view;
    expect(expectedZones(crowded)).toMatchObject({ deck: 12, 'stack-A': 8, 'prykup-A': 4 });
    expect(renderedZones(crowded)).toMatchObject({ deck: DECK_CAP, 'stack-A': STACK_CAP, 'prykup-A': PRYKUP_CAP, drawn: 1 });
    // Своя рука не ограничена: играть надо каждой картой, а не первыми FAN_CAP.
    expect(zoneLimit(`hand-${crowded.me}`, crowded.me)).toBe(Infinity);
    expect(zoneLimit('hand-B', crowded.me)).toBe(FAN_CAP);
    expect(cardsShown(crowded)).toBeLessThan(
      Object.values(expectedZones(crowded)).reduce((sum, n) => sum + n, 0),
    );
  });

  it('accepts a capped rendering as long as the declared number stays exact', () => {
    // phase1State кладёт в игру только эти 11 карт — тестовое состояние неполное, поэтому сумму сверяем с зонами.
    document.body.innerHTML =
      zone('deck', 3) + zone('drawn', 1) + zone('stack-A', 2) + zone('prykup-A', 0, 2, 0) + zone('stack-B', 1) + zone('prykup-B', 0, 2, 0);
    expect(zoneMismatches(document.body, view).filter((m) => !m.startsWith('total'))).toEqual([]);
    // Число обязано быть настоящим: объявить «10», когда в срезе 2, — ошибка даже при верном показе.
    document.body.innerHTML = zone('prykup-A', 0, 10, 0);
    expect(zoneMismatches(document.body, view).some((m) => m.startsWith('prykup-A'))).toBe(true);
  });

  it('reports an extra card, a missing zone, a duplicated zone and a wrong declaration', () => {
    document.body.innerHTML =
      zone('deck', 4, 3) + zone('drawn', 1) + zone('stack-A', 2) + zone('stack-A', 2) + zone('prykup-A', 1, 2, 0) + zone('prykup-B', 0, 2, 0);
    const problems = zoneMismatches(document.body, view);
    expect(problems.some((m) => m.startsWith('deck'))).toBe(true);
    expect(problems.some((m) => m.startsWith('stack-A'))).toBe(true);
    expect(problems.some((m) => m.startsWith('stack-B'))).toBe(true);
    expect(problems.some((m) => m.startsWith('prykup-A'))).toBe(true);
  });
});
