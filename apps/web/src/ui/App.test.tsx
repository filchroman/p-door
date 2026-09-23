import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalMatch } from '../client/createLocalMatch';
import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { testHostOptions } from '../test/hostOptions';
import { resetStore } from '../test/updates';
import { App } from './App';

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  localStorage.clear();
  resetStore({ makeClient: (setup) => createLocalMatch(setup, testHostOptions(1)) });
});
afterEach(() => {
  useAppStore.getState().goHome();
  vi.useRealTimers();
});

describe('App', () => {
  it('goes from the home screen through deck loading to the table', async () => {
    let release!: () => void;
    useAppStore.setState({ preload: () => new Promise<void>((resolve) => (release = resolve)) });
    render(<App />);
    expect(screen.getByRole('main')).toHaveClass('app-column');
    fireEvent.click(screen.getByRole('button', { name: ru.home.train }));
    fireEvent.click(screen.getByRole('button', { name: ru.home.play }));
    expect(screen.getByText(ru.home.loading)).toHaveAttribute('role', 'status');
    await act(async () => release());
    await vi.waitFor(() => expect(screen.getByTestId('player-p0')).toBeInTheDocument());
    expect(screen.getByTestId('player-p0')).toHaveTextContent(ru.defaultNick);
    expect(screen.getByTestId('player-p1')).toHaveTextContent(ru.botNames[0]);
    expect(screen.getByTestId('player-p2')).toHaveTextContent(ru.botNames[1]);
  });
});

describe('прокрутка на столе', () => {
  it('во время партии страница зафиксирована (класс is-game на body), на главной — нет', async () => {
    useAppStore.setState({ preload: () => Promise.resolve() });
    render(<App />);
    expect(document.body).not.toHaveClass('is-game');
    fireEvent.click(screen.getByRole('button', { name: ru.home.train }));
    fireEvent.click(screen.getByRole('button', { name: ru.home.play }));
    await vi.waitFor(() => expect(document.body).toHaveClass('is-game'));
    act(() => useAppStore.getState().goHome());
    expect(document.body).not.toHaveClass('is-game');
  });
});
