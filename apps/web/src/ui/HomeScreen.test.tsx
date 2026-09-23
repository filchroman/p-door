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
    fireEvent.click(screen.getByRole('button', { name: ru.home.train }));
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
    fireEvent.click(screen.getByRole('button', { name: ru.home.train }));
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

describe('HomeScreen: онлайн', () => {
  it('показывает имя и фото из Telegram и подключается сразу', () => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A7%7D&hash=abc',
        initDataUnsafe: { user: { id: 7, first_name: 'Рома', last_name: 'Ф', photo_url: 'https://t.me/i/7.jpg' } },
        ready() {},
        expand() {},
        openTelegramLink() {},
      },
    };
    const connect = vi.fn();
    resetStore({ connect });
    render(<HomeScreen />);
    const profile = screen.getByTestId('profile');
    expect(profile).toHaveTextContent('Рома Ф');
    expect(profile.querySelector('img')).toHaveAttribute('src', 'https://t.me/i/7.jpg');
    // В Telegram имя спрашивать не нужно — поле ника спрятано, соединение открывается само.
    expect(screen.queryByLabelText(ru.home.nickLabel)).toBeNull();
    expect(connect).toHaveBeenCalled();
    delete window.Telegram;
  });

  it('«Создать игру»: настройки → создать; «Войти по коду»: код → войти', () => {
    const connect = vi.fn();
    const createRoom = vi.fn();
    const joinRoom = vi.fn();
    resetStore({ connect, createRoom, joinRoom });
    render(<HomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: ru.home.createRoom }));
    fireEvent.click(radio(ru.home.players, '4'));
    fireEvent.click(screen.getByRole('button', { name: ru.home.create }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(createRoom).toHaveBeenCalledWith({ deckSize: 36, turnSeconds: 30, stallRule: 'forcedVidbiy' }, 4);
    fireEvent.click(screen.getByRole('button', { name: ru.home.back }));
    fireEvent.click(screen.getByRole('button', { name: ru.home.joinByCode }));
    fireEvent.change(screen.getByLabelText(ru.home.codeLabel), { target: { value: 'k7pq' } });
    fireEvent.click(screen.getByRole('button', { name: ru.home.join }));
    expect(joinRoom).toHaveBeenCalledWith('K7PQ');
  });
});
