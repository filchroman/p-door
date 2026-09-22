import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../i18n/ru';
import { resetStore } from '../test/updates';
import { HomeScreen, NICK_KEY } from './HomeScreen';

const radio = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name });

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe('HomeScreen', () => {
  it('has spec defaults: 3 players, 36 cards, 30 s, forced vidbiy', () => {
    render(<HomeScreen />);
    expect(radio(ru.home.players, '3')).toHaveAttribute('aria-checked', 'true');
    expect(radio(ru.home.deck, '36')).toHaveAttribute('aria-checked', 'true');
    expect(radio(ru.home.turnTime, ru.home.seconds(30))).toHaveAttribute('aria-checked', 'true');
    expect(radio(ru.home.stall, ru.home.stallRules.forcedVidbiy)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { name: ru.appTitle })).toHaveClass('script-title');
  });

  it('remembers the nick and starts a match with the chosen settings', () => {
    localStorage.setItem(NICK_KEY, 'Вася');
    const startMatch = vi.fn();
    resetStore({ startMatch });
    render(<HomeScreen />);
    expect(screen.getByLabelText(ru.home.nickLabel)).toHaveValue('Вася');
    fireEvent.change(screen.getByLabelText(ru.home.nickLabel), { target: { value: ' Петя ' } });
    fireEvent.click(radio(ru.home.players, '4'));
    fireEvent.click(radio(ru.home.deck, '52'));
    fireEvent.click(radio(ru.home.turnTime, ru.home.turnOff));
    fireEvent.click(radio(ru.home.stall, ru.home.stallRules.endGame));
    fireEvent.click(screen.getByRole('button', { name: ru.home.play }));
    expect(startMatch).toHaveBeenCalledWith({
      nick: 'Петя',
      playerCount: 4,
      settings: { deckSize: 52, turnSeconds: 0, stallRule: 'endGame' },
    });
    expect(localStorage.getItem(NICK_KEY)).toBe('Петя');
  });
});
