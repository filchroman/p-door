import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalMatch } from '../client/createLocalMatch';
import { useAppStore } from '../store/appStore';
import { testHostOptions } from '../test/hostOptions';
import { resetStore } from '../test/updates';
import { App } from './App';
import { zoneMismatches } from './table/zones';

beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => {
  useAppStore.getState().goHome();
  vi.useRealTimers();
});

describe('at-rest invariant', () => {
  it.each([
    [11, 3, 36],
    [12, 4, 52],
    [13, 6, 36],
  ] as const)('seed %i, %i players, %i cards: every zone matches the view after every event', async (seed, playerCount, deckSize) => {
    resetStore({ makeClient: (setup) => createLocalMatch(setup, testHostOptions(seed)) });
    const { container } = render(<App />);
    await act(() => useAppStore.getState().startMatch({ nick: 'Я', playerCount, settings: { deckSize, turnSeconds: 0, stallRule: 'forcedVidbiy' } }));
    act(() => {
      useAppStore.getState().setBotSpeed(3);
      useAppStore.getState().setAutopilot(true);
    });
    let checks = 0;
    for (let step = 0; step < 20_000; step++) {
      const update = useAppStore.getState().update!;
      if (update.session.status !== 'playing') break;
      const problems = zoneMismatches(container, update.view);
      if (problems.length > 0) throw new Error(`step ${step}, phase ${update.view.phase}: ${problems.join('; ')}`);
      checks++;
      act(() => {
        vi.advanceTimersToNextTimer();
      });
    }
    expect(useAppStore.getState().update!.session.status).toBe('gameOver');
    expect(checks).toBeGreaterThan(50);
  }, 120_000);
});
