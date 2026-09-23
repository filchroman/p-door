import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NO_FLIGHTS } from '../anim/flights';
import type { Origin } from '../anim/origins';
import { c, phase1State, phase2State } from '../../test/states';
import { makeUpdate, resetStore } from '../../test/updates';
import { Hand } from './Hand';
import { OpponentHand } from './OpponentHand';
import { Phase1Screen } from './Phase1Screen';
import { TableFan } from './TableFan';

/**
 * Каждый ход виден (спека §2c.1, §2c.2): приёмник получает коробку источника и отдаёт перелёт
 * верхнему слою — в конце `body` появляется `.flight-card` со сдвигом, с которого она стартует,
 * а сам приёмник на это время прячется (`.fly-from.is-away`), чтобы карты не было в двух местах.
 * happy-dom не считает раскладку: любая коробка в нуле, поэтому сдвиг равен центру источника.
 */
const flying = (): { x: string; y: string }[] =>
  [...document.querySelectorAll<HTMLElement>('.flight-layer .flight-card')].map((el) => ({
    x: el.style.getPropertyValue('--fly-x'),
    y: el.style.getPropertyValue('--fly-y'),
  }));

const away = (root: ParentNode): number => root.querySelectorAll('.fly-from.is-away').length;

/** Источник размером с карту: центр коробки и есть точка старта. */
const from = (x: number, y: number): Origin => ({ x, y, w: 0, h: 0 });

afterEach(() => {
  document.querySelector('.flight-layer')?.remove();
});

describe('перелёты на приёмниках', () => {
  it('карта прилетает на стопку, а не появляется на ней', () => {
    const state = phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C 9H' }], deck: 'TS' });
    resetStore({
      update: makeUpdate(state, 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, cards: { '9H': from(120, 240) } },
    });
    const { container } = render(<Phase1Screen />);
    expect(flying()).toEqual([{ x: '120px', y: '240px' }]);
    expect(away(container.querySelector('[data-zone="stack-B"]')!)).toBe(1);
  });

  it('летящая карта лежит в верхнем слое в конце body, а не внутри зоны', () => {
    const state = phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C 9H' }], deck: 'TS' });
    resetStore({ update: makeUpdate(state, 'A'), motionEnabled: true, flights: { ...NO_FLIGHTS, cards: { '9H': from(120, 240) } } });
    const { container } = render(<Phase1Screen />);
    const layer = document.querySelector('.flight-layer')!;
    expect(layer.parentElement).toBe(document.body);
    expect(document.body.lastElementChild).toBe(layer);
    // Слой вне зон: инвариант «в покое» его не считает (спека §2c.2).
    expect(container.querySelector('.flight-card')).toBeNull();
    expect(layer.closest('[data-zone]')).toBeNull();
  });

  it('карта прилетает на стол из руки бьющего', () => {
    resetStore({
      update: makeUpdate(phase2State({ players: [{ id: 'A', hand: '9H' }], trump: 'D', turn: 'A' }), 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, cards: { QC: from(30, 60) } },
    });
    render(<TableFan table={[{ card: c('QC'), by: 'B' }]} />);
    expect(flying()).toEqual([{ x: '30px', y: '60px' }]);
  });

  it('в мою руку карта прилетает со стола или из прикупа', () => {
    const state = phase2State({ players: [{ id: 'A', hand: '9H QC' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'B' });
    resetStore({
      update: makeUpdate(state, 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, hand: { from: from(140, 300), seq: 1, cards: ['QC'], count: 1 } },
    });
    render(<Hand />);
    // Летит ровно прилетевшая карта, а не весь веер.
    expect(flying()).toEqual([{ x: '140px', y: '300px' }]);
  });

  it('бот берёт карту — это видно: рубашка летит в его руку', () => {
    resetStore({
      update: makeUpdate(phase2State({ players: [{ id: 'A', hand: '9H' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'B' }), 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, hands: { B: { from: from(140, 300), seq: 1, cards: [], count: 2 } } },
    });
    const player = { id: 'B', prykupCount: 0, stackTop: null, stackCount: 5, handCount: 5, fouls: 0, out: false };
    const { container } = render(<OpponentHand player={player} cards={null} />);
    expect(container.querySelectorAll('[data-zone="hand-B"] .card')).toHaveLength(5);
    // Прилетели две последние рубашки, остальные три лежали и лежат.
    expect(flying()).toEqual([
      { x: '140px', y: '300px' },
      { x: '140px', y: '300px' },
    ]);
    expect(away(container)).toBe(2);
  });

  it('без перелёта карта просто лежит на месте', () => {
    const state = phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C 9H' }], deck: 'TS' });
    resetStore({ update: makeUpdate(state, 'A'), motionEnabled: true });
    const { container } = render(<Phase1Screen />);
    expect(flying()).toEqual([]);
    expect(away(container)).toBe(0);
    expect(screen.getByLabelText('Стопка: 2')).toBeInTheDocument();
  });
});
