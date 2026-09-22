import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../../i18n/ru';
import { c, penaltyState } from '../../test/states';
import { makeUpdate, resetStore, seatsFor } from '../../test/updates';
import { GameScreen } from '../GameScreen';
import { PenaltyModal } from './PenaltyModal';

const state = penaltyState({
  players: [{ id: 'A', hand: '6C 7C 8D' }, { id: 'B', hand: 'AH', fouls: 2 }, { id: 'C', hand: 'KS KD' }],
  trump: 'D',
  debts: [
    { from: 'A', to: 'B', count: 2 },
    { from: 'C', to: 'B', count: 2 },
  ],
});
const names = { A: 'Вася', B: 'Боря', C: 'Галя' };
const send = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  send.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('PenaltyModal', () => {
  it('asks me to choose cards for the fouled player, with a 20 s timer', () => {
    resetStore({
      update: makeUpdate(state, 'A', { players: seatsFor(state, names), deadlines: { turnEndsAt: null, turnTotalMs: null, penaltyEndsAt: 20_000, penaltyTotalMs: 20_000 } }),
      send,
    });
    render(<PenaltyModal />);
    const dialog = screen.getByRole('dialog', { name: ru.penalty.title });
    expect(within(dialog).getByText('Боря получил 2 фола — выберите 2 карты для него')).toBeInTheDocument();
    expect(within(dialog).getByRole('timer')).toHaveAttribute('aria-label', '20 с');
    expect(dialog.querySelector('[data-zone="hand-A"]')).toHaveAttribute('data-count', '3');
    expect(dialog.querySelectorAll('[data-zone="hand-A"] .card')).toHaveLength(3);
    fireEvent.click(within(dialog).getByRole('button', { name: '7♣' }));
    expect(send).toHaveBeenCalledWith({ type: 'givePenalty', to: 'B', card: c('7C') });
  });

  it('shows the waiting list when I owe nothing', () => {
    resetStore({ update: makeUpdate(state, 'B', { players: seatsFor(state, names) }), send });
    render(<PenaltyModal />);
    const dialog = screen.getByRole('dialog', { name: ru.penalty.title });
    expect(within(dialog).getByText(ru.penalty.waiting)).toBeInTheDocument();
    expect(within(dialog).getByText(ru.penalty.owes('Вася', 'Боря', 2))).toBeInTheDocument();
    expect(within(dialog).getByText(ru.penalty.owes('Галя', 'Боря', 2))).toBeInTheDocument();
    expect(within(dialog).queryByRole('button')).toBeNull();
  });

  it('GameScreen opens it only while there are debts', () => {
    resetStore({ update: makeUpdate(state, 'A'), send });
    const { unmount } = render(<GameScreen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    unmount();
    resetStore({ update: makeUpdate({ ...state, debts: [] }, 'A'), send });
    render(<GameScreen />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
