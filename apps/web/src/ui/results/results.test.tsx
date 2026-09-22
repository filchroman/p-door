import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../../i18n/ru';
import { phase2State } from '../../test/states';
import { makeUpdate, resetStore, seatsFor } from '../../test/updates';
import { CrashScreen } from './CrashScreen';
import { GameResults } from './GameResults';
import { SessionResults } from './SessionResults';

const base = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: '6C' }, { id: 'C', hand: '', out: true }], trump: 'D', turn: 'B' });
const over = (loserId: string | null) => ({
  ...base,
  phase: 'over' as const,
  result: { loserId, winnerId: 'C', outOrder: ['C', 'A'], technical: false },
});
const players = seatsFor(base, { A: 'Вася', B: 'Боря', C: 'Галя' });
const session = (extra: object = {}) => ({
  gameNumber: 2, losses: { B: 2, A: 1 }, vakhterId: 'B', status: 'gameOver' as const, canContinue: true, ...extra,
});

const nextGame = vi.fn();
const endSession = vi.fn();
const goHome = vi.fn();
const restart = vi.fn();

beforeEach(() => {
  for (const fn of [nextGame, endSession, goHome, restart]) fn.mockReset();
});

describe('GameResults', () => {
  it('names the loser, the prykup growth and the session table', () => {
    resetStore({ update: makeUpdate(over('B'), 'A', { players, session: session() }), nextGame, endSession });
    render(<GameResults />);
    expect(screen.getByRole('heading', { name: ru.results.title })).toBeInTheDocument();
    expect(screen.getByText(ru.results.gameNo(2))).toBeInTheDocument();
    expect(screen.getByText(ru.results.loser('Боря'))).toBeInTheDocument();
    expect(screen.getByText(ru.results.prykupUp)).toBeInTheDocument();
    const rows = within(screen.getByRole('table', { name: ru.results.losses })).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('Боря2'), expect.stringContaining('Вася1'), expect.stringContaining('Галя0')]);
    fireEvent.click(screen.getByRole('button', { name: ru.results.again }));
    fireEvent.click(screen.getByRole('button', { name: ru.results.endEvening }));
    expect(nextGame).toHaveBeenCalledOnce();
    expect(endSession).toHaveBeenCalledOnce();
  });

  it('celebrates my win with my avatar in the middle', () => {
    resetStore({ update: makeUpdate(over('B'), 'A', { players, session: session() }), motionEnabled: true });
    const { container } = render(<GameResults />);
    expect(screen.getByText(ru.results.win)).toBeInTheDocument();
    expect(container.querySelector('.results__hero .avatar')).toHaveTextContent('🙂');
    expect(container.querySelector('canvas.confetti')).not.toBeNull();
  });

  it('shows the comedic «Вахтер» when I lost', () => {
    resetStore({ update: makeUpdate(over('A'), 'A', { players, session: session() }) });
    const { container } = render(<GameResults />);
    expect(screen.getByText(ru.results.youLost)).toBeInTheDocument();
    expect(container.querySelector('.results__stamp')).toHaveTextContent(ru.fx.vakhterStamp);
    expect(screen.queryByText(ru.results.win)).toBeNull();
  });

  it('shows a draw', () => {
    resetStore({ update: makeUpdate(over(null), 'A', { players, session: session() }) });
    render(<GameResults />);
    expect(screen.getByText(ru.results.draw)).toHaveClass('results__draw');
    expect(screen.queryByText(ru.results.prykupUp)).toBeNull();
    expect(screen.queryByText(ru.results.win)).toBeNull();
  });

  it('blocks the next game when the next deal cannot be made', () => {
    resetStore({ update: makeUpdate(over('B'), 'A', { players, session: session({ canContinue: false }) }) });
    render(<GameResults />);
    expect(screen.getByRole('button', { name: ru.results.again })).toBeDisabled();
    expect(screen.getByText(ru.results.cannotDeal)).toBeInTheDocument();
  });
});

describe('SessionResults', () => {
  it('crowns the Vakhter of the evening', () => {
    resetStore({ update: makeUpdate(over('B'), 'A', { players, session: session({ status: 'sessionOver' }) }), goHome });
    render(<SessionResults />);
    expect(screen.getByRole('heading', { name: ru.session.title })).toHaveClass('script-title--huge');
    expect(screen.getByText('Боря', { selector: '.vakhter__name' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ru.session.home }));
    expect(goHome).toHaveBeenCalledOnce();
  });

  it('handles an evening without losers', () => {
    resetStore({ update: makeUpdate(over(null), 'A', { players, session: session({ status: 'sessionOver', losses: {}, vakhterId: null }) }) });
    render(<SessionResults />);
    expect(screen.getByText(ru.session.nobody)).toBeInTheDocument();
  });
});

describe('CrashScreen', () => {
  it('offers a restart', () => {
    resetStore({ restart });
    render(<CrashScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(ru.crash.title);
    fireEvent.click(screen.getByRole('button', { name: ru.crash.restart }));
    expect(restart).toHaveBeenCalledOnce();
  });
});
