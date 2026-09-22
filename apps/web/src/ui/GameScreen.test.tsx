import { act, render, screen } from '@testing-library/react';
import type { GameResult, GameState } from '@vakhta/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchSetup } from '../client/createLocalMatch';
import type { SessionStatus } from '../host/types';
import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { FX_MS } from '../store/derive';
import { phase1State, phase2State } from '../test/states';
import { fakeClient, makeUpdate, resetStore } from '../test/updates';
import { GameScreen } from './GameScreen';

const state = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }], deck: 'KD 8C' });
const session = (status: SessionStatus) => ({ gameNumber: 1, losses: {}, vakhterId: null, status, canContinue: true });
const withStatus = (status: SessionStatus) => makeUpdate(state, 'A', { session: session(status) });

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

const setup: MatchSetup = { nick: 'Я', playerCount: 2, settings: { deckSize: 36, turnSeconds: 0, stallRule: 'forcedVidbiy' } };
const playing = () =>
  makeUpdate(phase2State({ players: [{ id: 'A', hand: '6C' }, { id: 'B', hand: '7C' }], trump: 'D', turn: 'A' }), 'A');
const result: GameResult = { loserId: 'B', winnerId: 'A', outOrder: ['A'], technical: false };
const finished = (technical: boolean): GameState => {
  const base = phase2State({ players: [{ id: 'A', hand: '', out: !technical }, { id: 'B', hand: '7C' }], trump: 'D', turn: 'B' });
  return { ...base, phase: 'over', result: { ...result, technical } };
};
/** Я вышел последним ходом — движок шлёт `out` и `gameOver` одной пачкой. */
const iWentOut = () =>
  makeUpdate(finished(false), 'A', { session: session('gameOver'), events: [{ type: 'out', playerId: 'A' }, { type: 'gameOver', result }] });
/** Техническое поражение (сдача) — никто не выходил, праздновать нечего. */
const surrendered = () =>
  makeUpdate(finished(true), 'A', {
    session: session('gameOver'),
    events: [{ type: 'gameOver', result: { ...result, loserId: 'A', winnerId: null, outOrder: [], technical: true } }],
  });

const results = () => screen.queryByRole('heading', { name: ru.results.title });
const start = async (emitFirst = playing()) => {
  const { client, emit } = fakeClient(emitFirst);
  resetStore({ makeClient: () => client, motionEnabled: true });
  await act(() => useAppStore.getState().startMatch(setup));
  render(<GameScreen />);
  return emit;
};

describe('GameScreen: the celebration beat before the results', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => {
    useAppStore.getState().goHome();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the table with the ribbon and confetti for a beat, then opens the results', async () => {
    const emit = await start();
    act(() => emit(iWentOut()));
    expect(screen.getByText(ru.fx.outRibbon)).toBeInTheDocument();
    expect(document.querySelector('canvas.confetti')).not.toBeNull();
    expect(results()).toBeNull();
    act(() => vi.advanceTimersByTime(FX_MS - 1));
    expect(results()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(results()).not.toBeNull();
    expect(screen.queryByText(ru.fx.outRibbon)).toBeNull();
  });

  it('a technical loss has nobody going out — the results open at once', async () => {
    const emit = await start();
    act(() => emit(surrendered()));
    expect(results()).not.toBeNull();
  });

  it('with reduced motion the hold is skipped', async () => {
    const emit = await start();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
    act(() => emit(iWentOut()));
    expect(results()).not.toBeNull();
  });
});
