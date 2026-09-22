import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalMatch } from '../../client/createLocalMatch';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { testHostOptions } from '../../test/hostOptions';
import { resetStore } from '../../test/updates';
import { DebugPanel } from './DebugPanel';

const setup = { nick: 'Вася', playerCount: 3, settings: { deckSize: 36 as const, turnSeconds: 0 as const, stallRule: 'forcedVidbiy' as const } };

beforeEach(async () => {
  vi.useFakeTimers({ now: 0 });
  resetStore({ makeClient: (s) => createLocalMatch(s, testHostOptions(4)) });
  await useAppStore.getState().startMatch(setup);
});
afterEach(() => {
  useAppStore.getState().goHome();
  vi.useRealTimers();
});

const openPanel = () => {
  render(<DebugPanel />);
  fireEvent.click(screen.getByRole('button', { name: ru.debug.open }));
  return screen.getByRole('complementary', { name: ru.debug.title });
};

describe('DebugPanel', () => {
  it('is hidden behind the bug button', () => {
    render(<DebugPanel />);
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: ru.debug.open }));
    expect(screen.getByRole('button', { name: ru.debug.open })).toHaveAttribute('aria-expanded', 'true');
  });

  it('play as another seat switches my view', () => {
    const panel = openPanel();
    const group = within(panel).getByRole('radiogroup', { name: ru.debug.playAs });
    expect(within(group).getByRole('radio', { name: 'Вася' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(group).getByRole('radio', { name: ru.botNames[1] }));
    expect(useAppStore.getState().update!.view.me).toBe('p2');
  });

  it('shows all hands, sets bot speed and autopilot', () => {
    const panel = openPanel();
    fireEvent.click(within(panel).getByRole('checkbox', { name: ru.debug.showHands }));
    expect(Object.keys(useAppStore.getState().allHands!)).toEqual(['p0', 'p1', 'p2']);
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: ru.debug.botSpeed })).getByRole('radio', { name: ru.debug.speed(3) }));
    fireEvent.click(within(panel).getByRole('checkbox', { name: ru.debug.autopilot }));
    expect(useAppStore.getState().debug).toMatchObject({ showAllHands: true, botSpeed: 3, autopilot: true });
  });

  it('shows an FPS meter', () => {
    const panel = openPanel();
    expect(within(panel).getByLabelText(ru.debug.fps).tagName).toBe('OUTPUT');
  });

  it('shows the event log, newest first', () => {
    const panel = openPanel();
    expect(within(panel).getByRole('heading', { name: ru.debug.log })).toBeInTheDocument();
    expect(within(panel).getByRole('list').firstElementChild).toHaveTextContent('game 1');
  });
});
