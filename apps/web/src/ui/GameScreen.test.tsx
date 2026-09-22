import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '../host/types';
import { ru } from '../i18n/ru';
import { phase1State } from '../test/states';
import { makeUpdate, resetStore } from '../test/updates';
import { GameScreen } from './GameScreen';

const state = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }], deck: 'KD 8C' });
const withStatus = (status: SessionStatus) =>
  makeUpdate(state, 'A', { session: { gameNumber: 1, losses: {}, vakhterId: null, status, canContinue: true } });

describe('GameScreen routing', () => {
  it('shows the table while playing', () => {
    resetStore({ update: withStatus('playing') });
    render(<GameScreen />);
    expect(screen.getByRole('button', { name: ru.table.deckLabel(2) })).toBeInTheDocument();
  });

  it.each([
    ['gameOver', ru.results.title],
    ['sessionOver', ru.session.title],
    ['crashed', ru.crash.title],
  ] as const)('status %s → %s', (status, heading) => {
    resetStore({ update: withStatus(status) });
    render(<GameScreen />);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('treats a missing update as a crash', () => {
    resetStore({ screen: 'game', update: null });
    render(<GameScreen />);
    expect(screen.getByRole('heading', { name: ru.crash.title })).toBeInTheDocument();
  });
});
