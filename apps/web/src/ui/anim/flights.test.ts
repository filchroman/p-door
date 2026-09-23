import { beforeEach, describe, expect, it } from 'vitest';
import { c, phase1State, phase2State } from '../../test/states';
import { makeUpdate } from '../../test/updates';
import { flightsFor } from './flights';

/** happy-dom не считает раскладку: ставим коробки руками, как это сделал бы браузер. */
function place(el: HTMLElement, x: number, y: number): HTMLElement {
  el.getBoundingClientRect = () =>
    ({ left: x, top: y, right: x + 84, bottom: y + 126, width: 84, height: 126, x, y, toJSON: () => ({}) }) as DOMRect;
  return el;
}

function zone(name: string, x: number, y: number, cards: string[] = []): HTMLElement {
  const el = document.createElement('div');
  el.dataset.zone = name;
  place(el, x, y);
  for (const key of cards) {
    const card = document.createElement('div');
    card.dataset.card = key;
    place(card, x + 4, y + 4);
    el.append(card);
  }
  document.body.append(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

const p1 = () => phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C' }], deck: 'TS 9D', drawn: 'QS' });

describe('flightsFor: откуда летит карта (§2c.1)', () => {
  it('«+1» и «оставил себе»: карта летит со своего места в слоте вытянутой', () => {
    zone('drawn', 200, 300, ['QS']);
    const update = makeUpdate(p1(), 'A', { events: [{ type: 'placed', playerId: 'B', to: 'A', card: c('QS') }] });
    expect(flightsFor(null, update).cards.QS).toEqual({ x: 204, y: 304, w: 84, h: 126 });
  });

  it('«переложил»: своя верхняя карта летит со своей стопки на чужую', () => {
    zone('stack-B', 40, 120, ['7C']);
    const update = makeUpdate(p1(), 'A', { events: [{ type: 'movedTop', from: 'B', to: 'A', card: c('7C') }] });
    expect(flightsFor(null, update).cards['7C']).toEqual({ x: 44, y: 124, w: 84, h: 126 });
  });

  it('бьёт бот — карта летит от его руки, бью я — со своего места в веере', () => {
    zone('hand-B', 30, 60);
    zone('hand-A', 100, 700, ['9H']);
    const state = phase2State({ players: [{ id: 'A', hand: '9H' }, { id: 'B', hand: 'QC' }], trump: 'D', turn: 'A' });
    const byBot = makeUpdate(state, 'A', { events: [{ type: 'played', playerId: 'B', card: c('QC') }] });
    expect(flightsFor(null, byBot).cards.QC).toEqual({ x: 30, y: 60, w: 84, h: 126 });
    const byMe = makeUpdate(state, 'A', { events: [{ type: 'played', playerId: 'A', card: c('9H') }] });
    expect(flightsFor(null, byMe).cards['9H']).toEqual({ x: 104, y: 704, w: 84, h: 126 });
  });

  it('«взял нижнюю»: моя карта летит в руку открытой, чужая — рубашкой, но обе летят', () => {
    zone('table', 140, 300, ['6D']);
    const state = phase2State({ players: [{ id: 'A', hand: '9H' }, { id: 'B', hand: 'QC' }], table: [['6D', 'B']], trump: 'D', turn: 'A' });
    const mine = flightsFor(null, makeUpdate(state, 'A', { events: [{ type: 'tookBottom', playerId: 'A', card: c('6D') }] }));
    expect(mine.hand).toEqual({ from: { x: 144, y: 304, w: 84, h: 126 }, seq: 0, cards: ['6D'], count: 1 });
    const theirs = flightsFor(null, makeUpdate(state, 'A', { events: [{ type: 'tookBottom', playerId: 'B', card: c('6D') }] }));
    expect(theirs.hands.B).toEqual({ from: { x: 144, y: 304, w: 84, h: 126 }, seq: 0, cards: [], count: 1 });
    expect(theirs.hand).toBeNull();
  });

  it('открытый прикуп: свои карты летят из прикупа поимённо, чужие — числом рубашек', () => {
    zone('prykup-A', 300, 600);
    zone('prykup-B', 20, 100);
    const before = phase2State({ players: [{ id: 'A', hand: '9H', prykup: 'KS QD' }, { id: 'B', hand: 'QC', prykup: 'TS' }], trump: 'D', turn: 'A' });
    const after = phase2State({ players: [{ id: 'A', hand: '9H KS QD' }, { id: 'B', hand: 'QC TS' }], trump: 'D', turn: 'A' });
    const mine = flightsFor(makeUpdate(before, 'A'), makeUpdate(after, 'A', { events: [{ type: 'prykupOpened', playerId: 'A' }] }));
    expect(mine.hand).toEqual({ from: { x: 300, y: 600, w: 84, h: 126 }, seq: 0, cards: ['KS', 'QD'], count: 2 });
    const theirs = flightsFor(makeUpdate(before, 'A'), makeUpdate(after, 'A', { events: [{ type: 'prykupOpened', playerId: 'B' }] }));
    expect(theirs.hands.B).toEqual({ from: { x: 20, y: 100, w: 84, h: 126 }, seq: 0, cards: [], count: 1 });
  });

  it('нет источника на экране — нет и перелёта: лучше без него, чем из угла экрана', () => {
    const update = makeUpdate(p1(), 'A', { events: [{ type: 'placed', playerId: 'B', to: 'A', card: c('QS') }] });
    expect(flightsFor(null, update)).toEqual({ cards: {}, delays: {}, hands: {}, hand: null });
  });
});
