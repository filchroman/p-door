import type { ServerMessage } from '@vakhta/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocketGameClient, type SocketLike } from '../client/SocketGameClient';
import { phase1State } from '../test/states';
import { makeUpdate, resetStore } from '../test/updates';
import { useAppStore } from './appStore';
import { roomCodeFromLocation } from './online';

class FakeSocket implements SocketLike {
  readyState = 1;
  sent: { type: string }[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {}
  receive(m: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}

let socket: FakeSocket;
const me = { id: 'anon:t', name: 'Рома', avatar: '🙂' };
const room = { code: 'K7PQ', hostId: me.id, seats: [{ ...me, isBot: false, online: true }], playerCount: 2, settings: { deckSize: 36 as const, turnSeconds: 0 as const, stallRule: 'forcedVidbiy' as const }, fillBots: true, status: 'lobby' as const, losses: {}, gameNumber: 0 };

beforeEach(() => {
  vi.useFakeTimers();
  socket = new FakeSocket();
  resetStore({
    makeOnlineClient: (auth, code) => new SocketGameClient({ url: 'ws://x', auth, room: code, connect: () => socket }),
    fetchConfig: () => Promise.resolve({ botUsername: 'vakhta_bot', appShortName: 'game' }),
  });
});
afterEach(() => {
  useAppStore.getState().goHome();
  vi.useRealTimers();
});

describe('онлайн в сторе', () => {
  it('подключение → комната → лобби → первый срез открывает стол; итоги вечера возвращают в лобби', async () => {
    useAppStore.getState().connect('Рома');
    socket.onopen?.({});
    expect(socket.sent[0]).toMatchObject({ type: 'hello', auth: { kind: 'anon', nick: 'Рома' } });
    socket.receive({ type: 'hello:ok', me, room: null });
    expect(useAppStore.getState().online).toMatchObject({ me, connection: 'live' });
    useAppStore.getState().createRoom(room.settings, 2);
    socket.receive({ type: 'room:state', room });
    expect(useAppStore.getState().screen).toBe('lobby');
    await vi.waitFor(() => expect(useAppStore.getState().inviteLink()).toBe('https://t.me/vakhta_bot/game?startapp=K7PQ'));

    const u = makeUpdate(phase1State({ players: [{ id: me.id, stack: '7H' }, { id: 'bot1', stack: 'QC' }], deck: '9S 8C' }), me.id);
    socket.receive({ type: 'room:state', room: { ...room, status: 'playing' } });
    socket.receive({ type: 'game:view', view: u.view, version: 1, events: [], session: u.session, players: u.players, deadlines: u.deadlines });
    expect(useAppStore.getState().screen).toBe('game');
    expect(useAppStore.getState().update?.view.me).toBe(me.id);

    // Хост закрыл вечер: комната снова лобби, а «На главную» с итогов ведёт в неё, не рвя соединение.
    socket.receive({ type: 'game:view', view: u.view, version: 2, events: [], session: { ...u.session, status: 'sessionOver' }, players: u.players, deadlines: u.deadlines });
    socket.receive({ type: 'room:state', room });
    useAppStore.getState().goHome();
    expect(useAppStore.getState().screen).toBe('lobby');
    expect(useAppStore.getState().online.client).not.toBeNull();
  });

  it('ошибка комнаты — плашка по-русски; выход из комнаты возвращает на главную', () => {
    useAppStore.getState().connect('Рома');
    socket.onopen?.({});
    socket.receive({ type: 'hello:ok', me, room: null });
    socket.receive({ type: 'error', code: 'no_room' });
    expect(useAppStore.getState().toasts.at(-1)).toMatchObject({ text: 'Комнаты с таким кодом нет', tone: 'error' });
    socket.receive({ type: 'room:state', room });
    expect(useAppStore.getState().screen).toBe('lobby');
    useAppStore.getState().leaveRoom();
    expect(socket.sent.at(-1)).toEqual({ type: 'room:leave' });
    expect(useAppStore.getState().screen).toBe('home');
  });

  it('код комнаты читается из адреса /r/CODE и уходит в hello', () => {
    expect(roomCodeFromLocation('/r/k7pq')).toBe('K7PQ');
    expect(roomCodeFromLocation('/')).toBeNull();
    useAppStore.setState({ online: { ...useAppStore.getState().online, pendingCode: 'K7PQ' } });
    useAppStore.getState().connect('Рома');
    socket.onopen?.({});
    expect(socket.sent[0]).toMatchObject({ type: 'hello', room: 'K7PQ' });
  });
});
