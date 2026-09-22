import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NO_FLIGHTS } from '../anim/flights';
import { c, phase1State, phase2State } from '../../test/states';
import { makeUpdate, resetStore } from '../../test/updates';
import { Hand } from './Hand';
import { OpponentHand } from './OpponentHand';
import { Phase1Screen } from './Phase1Screen';
import { TableFan } from './TableFan';

/**
 * Каждый ход виден (спека §2c.1): приёмник получает точку старта и действительно проигрывает
 * перелёт — у карты появляется `.fly-from.is-flying` со сдвигом, с которого она стартует.
 * happy-dom не считает раскладку: любая коробка в нуле, поэтому сдвиг равен самой точке старта.
 */
const flying = (root: ParentNode): { x: string; y: string }[] =>
  [...root.querySelectorAll<HTMLElement>('.fly-from.is-flying')].map((el) => ({
    x: el.style.getPropertyValue('--fly-x'),
    y: el.style.getPropertyValue('--fly-y'),
  }));

describe('перелёты на приёмниках', () => {
  it('карта прилетает на стопку, а не появляется на ней', () => {
    const state = phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C 9H' }], deck: 'TS' });
    resetStore({
      update: makeUpdate(state, 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, cards: { '9H': { x: 120, y: 240 } } },
    });
    const { container } = render(<Phase1Screen />);
    expect(flying(container.querySelector('[data-zone="stack-B"]')!)).toEqual([{ x: '120px', y: '240px' }]);
  });

  it('карта прилетает на стол из руки бьющего', () => {
    resetStore({
      update: makeUpdate(phase2State({ players: [{ id: 'A', hand: '9H' }], trump: 'D', turn: 'A' }), 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, cards: { QC: { x: 30, y: 60 } } },
    });
    const { container } = render(<TableFan table={[{ card: c('QC'), by: 'B' }]} />);
    expect(flying(container)).toEqual([{ x: '30px', y: '60px' }]);
  });

  it('в мою руку карта прилетает со стола или из прикупа', () => {
    const state = phase2State({ players: [{ id: 'A', hand: '9H QC' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'B' });
    resetStore({
      update: makeUpdate(state, 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, hand: { from: { x: 140, y: 300 }, cards: ['QC'], count: 1 } },
    });
    const { container } = render(<Hand />);
    // Летит ровно прилетевшая карта, а не весь веер.
    expect(flying(container)).toEqual([{ x: '140px', y: '300px' }]);
  });

  it('бот берёт карту — это видно: рубашка летит в его руку', () => {
    resetStore({
      update: makeUpdate(phase2State({ players: [{ id: 'A', hand: '9H' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'B' }), 'A'),
      motionEnabled: true,
      flights: { ...NO_FLIGHTS, hands: { B: { from: { x: 140, y: 300 }, cards: [], count: 2 } } },
    });
    const player = { id: 'B', prykupCount: 0, stackTop: null, stackCount: 5, handCount: 5, fouls: 0, out: false };
    const { container } = render(<OpponentHand player={player} cards={null} />);
    expect(container.querySelectorAll('[data-zone="hand-B"] .card')).toHaveLength(5);
    // Прилетели две последние рубашки, остальные три лежали и лежат.
    expect(flying(container)).toEqual([
      { x: '140px', y: '300px' },
      { x: '140px', y: '300px' },
    ]);
  });

  it('без перелёта карта просто лежит на месте', () => {
    const state = phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C 9H' }], deck: 'TS' });
    resetStore({ update: makeUpdate(state, 'A'), motionEnabled: true });
    const { container } = render(<Phase1Screen />);
    expect(flying(container)).toEqual([]);
    expect(screen.getByLabelText('Стопка: 2')).toBeInTheDocument();
  });
});
