import { fireEvent, render, screen } from '@testing-library/react';
import type { RoomState } from '@vakhta/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { inviteLink } from '../store/online';
import { resetStore } from '../test/updates';
import { LobbyScreen } from './LobbyScreen';

const room: RoomState = {
  code: 'K7PQ',
  hostId: 'tg:1',
  seats: [
    { id: 'tg:1', name: 'Рома', avatar: 'https://t.me/i/1.jpg', isBot: false, online: true },
    { id: 'tg:2', name: 'Галя', avatar: '🦊', isBot: false, online: false },
  ],
  playerCount: 3,
  settings: { deckSize: 36, turnSeconds: 30, stallRule: 'forcedVidbiy' },
  fillBots: true,
  status: 'lobby',
  losses: {},
  gameNumber: 0,
};

const online = (meId: string) => ({ client: null, me: { id: meId, name: 'Я', avatar: '🙂' }, room, connection: 'live' as const, config: { botUsername: 'vakhta_bot', appShortName: 'game' }, pendingCode: null });

beforeEach(() => resetStore());

describe('LobbyScreen', () => {
  it('код, места со связью, хост видит «Старт» и правит настройки', () => {
    const startRoom = vi.fn();
    const configureRoom = vi.fn();
    resetStore({ online: online('tg:1'), startRoom, configureRoom });
    render(<LobbyScreen />);
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7PQ');
    expect(screen.getByText(ru.lobby.seats(2, 3))).toBeInTheDocument();
    expect(screen.getByText('Галя').parentElement).toHaveClass('is-offline');
    fireEvent.click(screen.getByRole('radio', { name: '52' }));
    expect(configureRoom).toHaveBeenCalledWith({ deckSize: 52, turnSeconds: 30, stallRule: 'forcedVidbiy' }, 3);
    fireEvent.click(screen.getByRole('button', { name: ru.lobby.start }));
    expect(startRoom).toHaveBeenCalled();
  });

  it('гость ждёт хоста, настройки ему недоступны', () => {
    resetStore({ online: online('tg:2') });
    render(<LobbyScreen />);
    expect(screen.getByRole('status')).toHaveTextContent(ru.lobby.waiting);
    expect(screen.queryByRole('button', { name: ru.lobby.start })).toBeNull();
    expect(screen.getByRole('radio', { name: '52' })).toBeDisabled();
  });

  it('«Пригласить» вне Telegram копирует ссылку Mini App', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    resetStore({ online: online('tg:1') });
    render(<LobbyScreen />);
    fireEvent.click(screen.getByRole('button', { name: ru.lobby.invite }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('https://t.me/vakhta_bot/game?startapp=K7PQ'));
    expect(useAppStore.getState().toasts.at(-1)?.text).toBe(ru.lobby.copied);
  });

  it('ссылка без бота ведёт на страницу с кодом', () => {
    expect(inviteLink('K7PQ', null, 'https://vakhta.example')).toBe('https://vakhta.example/r/K7PQ');
  });
});
