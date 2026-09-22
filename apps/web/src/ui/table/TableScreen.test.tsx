import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../store/appStore';
import { emptyMarks } from '../../store/derive';
import { phase2State } from '../../test/states';
import { makeUpdate, resetStore, seatsFor } from '../../test/updates';
import { TableScreen } from './TableScreen';

const state = phase2State({
  players: [{ id: 'A', hand: '6C 7C' }, { id: 'B', hand: '8C' }, { id: 'C', hand: '', out: true }, { id: 'D', hand: '' }],
  trump: 'H',
  // Последней картой колоды была пика — козырной масть сделала 9♥, её и показывает значок.
  trumpCard: '9H',
  turn: 'B',
  table: [['9H', 'A']],
});

beforeEach(() => {
  resetStore({
    update: makeUpdate(state, 'A', {
      players: seatsFor(state, { A: 'Вася', B: 'Боря', C: 'Галя', D: 'Люда' }),
      deadlines: { turnEndsAt: Date.now() + 15_000, turnTotalMs: 15_000, penaltyEndsAt: null, penaltyTotalMs: null },
    }),
    marks: { ...emptyMarks(1), acts: { A: 'took' } },
  });
});

describe('TableScreen', () => {
  it('places opponents on top in seat order and me in the bottom bar', () => {
    render(<TableScreen center={<div>центр</div>} mine={<div>моё</div>} action={<button type="button">действие</button>} />);
    expect(screen.getAllByTestId(/^player-/).map((el) => el.dataset.testid)).toEqual(['player-B', 'player-C', 'player-D', 'player-A']);
    expect(within(screen.getByTestId('player-A')).getByText('Вася')).toBeInTheDocument();
    expect(screen.getByText('центр')).toBeInTheDocument();
    expect(screen.getByText('моё')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'действие' })).toBeInTheDocument();
  });

  it('shows status plaques and the turn countdown bar', () => {
    render(<TableScreen center={null} mine={null} action={null} />);
    expect(within(screen.getByTestId('player-B')).getByText('Ходит')).toBeInTheDocument();
    expect(within(screen.getByTestId('player-B')).getByRole('timer')).toHaveAttribute('aria-label', '15 с');
    expect(within(screen.getByTestId('player-C')).getByText('Вышел')).toBeInTheDocument();
    expect(within(screen.getByTestId('player-D')).getByText('Ждёт отбоя')).toBeInTheDocument();
    expect(within(screen.getByTestId('player-A')).getByText('Берёт')).toBeInTheDocument();
  });

  it('shows trump and the k/N counter in the bottom bar, and the total of cards in play', () => {
    const { container } = render(<TableScreen center={null} mine={null} action={null} />);
    const badge = screen.getByRole('img', { name: 'Козырь: чирва' });
    expect(badge.querySelector('.trump-badge__card')).toHaveAttribute('src', expect.stringContaining('9H'));
    expect(screen.getByText('1/3 до отбоя')).toBeInTheDocument();
    expect(container.querySelector('.table-screen')).toHaveAttribute('data-total', '36');
  });

  it('renders per-opponent extras', () => {
    render(<TableScreen center={null} mine={null} action={null} opponentExtras={(p) => <span>{`x-${p.id}`}</span>} />);
    expect(within(screen.getByTestId('player-D')).getByText('x-D')).toBeInTheDocument();
    expect(screen.queryByText('x-A')).toBeNull();
  });

  it('stamps «ВАХТА!» on a freshly caught offender and «Поймал!» on the caller', () => {
    useAppStore.setState({
      marks: { ...emptyMarks(1), seq: 1, vakhtaBy: 'A', vakhtaCaught: true, caught: { seq: 1, at: Date.now(), offenders: ['B'], callerId: 'A' } },
    });
    render(<TableScreen center={null} mine={null} action={null} />);
    const offender = screen.getByTestId('player-B');
    expect(offender.querySelector('.fx-stamp')).toHaveTextContent('ВАХТА!');
    expect(offender.querySelector('.fx-chip')).not.toBeNull();
    expect(offender.querySelector('.avatar-shake')).not.toBeNull();
    expect(within(screen.getByTestId('player-A')).getByText('Поймал!')).toBeInTheDocument();
    expect(screen.getByTestId('player-D').querySelector('.fx-stamp')).toBeNull();
  });

  it('does not replay an old effect when the frame mounts later', () => {
    useAppStore.setState({ marks: { ...emptyMarks(1), seq: 1, caught: { seq: 1, at: Date.now() - 5000, offenders: ['B'], callerId: 'A' } } });
    render(<TableScreen center={null} mine={null} action={null} />);
    expect(screen.getByTestId('player-B').querySelector('.fx-stamp')).toBeNull();
  });

  it('a tap on an empty spot of the table cancels the selection', () => {
    useAppStore.setState({ selection: { kind: 'drawn' } });
    const { container } = render(<TableScreen center={null} mine={null} action={null} />);
    fireEvent.click(container.querySelector('.table-center')!);
    expect(useAppStore.getState().selection).toBeNull();
  });
});
