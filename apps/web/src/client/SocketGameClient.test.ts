import type { ServerMessage } from '@vakhta/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phase2State } from '../test/states';
import { makeUpdate } from '../test/updates';
import { SocketGameClient, type SocketLike } from './SocketGameClient';

/** Фейковый сокет: тест сам открывает, закрывает и «присылает» сообщения. */
class FakeSocket implements SocketLike {
  readyState = 0;
  sent: unknown[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
    this.onclose?.({});
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const sockets: FakeSocket[] = [];
const connect = () => {
  const s = new FakeSocket();
  sockets.push(s);
  return s;
};
const auth = { kind: 'anon' as const, token: 'token-0000000001', nick: 'Рома' };
const me = { id: 'anon:token-0000000001', name: 'Рома', avatar: '🙂' };
const room = { code: 'K7PQ', hostId: me.id, seats: [{ ...me, isBot: false, online: true }], playerCount: 3, settings: { deckSize: 36 as const, turnSeconds: 30 as const, stallRule: 'forcedVidbiy' as const }, fillBots: true, status: 'lobby' as const, losses: {}, gameNumber: 0 };

beforeEach(() => {
  sockets.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('SocketGameClient', () => {
  it('здоровается при открытии, отдаёт комнату и «меня» слушателю', () => {
    const client = new SocketGameClient({ url: 'ws://test/ws', auth, room: 'K7PQ', connect });
    const seen: unknown[] = [];
    client.onRoom((s) => seen.push(s));
    sockets[0].open();
    expect(sockets[0].sent[0]).toEqual({ type: 'hello', auth, room: 'K7PQ' });
    sockets[0].receive({ type: 'hello:ok', me, room });
    expect(client.me()).toBe(me.id);
    expect(seen.at(-1)).toMatchObject({ me, room, connection: 'live' });
    client.dispose();
  });

  it('срезы партии идут подписчикам, ошибки движка — в onError, ошибки комнаты — отдельно', () => {
    const client = new SocketGameClient({ url: 'ws://test/ws', auth, connect });
    sockets[0].open();
    sockets[0].receive({ type: 'hello:ok', me, room: null });
    const updates: unknown[] = [];
    const engineErrors: string[] = [];
    const roomErrors: string[] = [];
    client.subscribe((u) => updates.push(u));
    client.onError((c) => engineErrors.push(c));
    client.onRoomError((c) => roomErrors.push(c));
    const u = makeUpdate(phase2State({ players: [{ id: me.id, hand: '7H' }, { id: 'bot1', hand: 'QC' }], trump: 'D', turn: me.id }), me.id);
    sockets[0].receive({ type: 'game:view', view: u.view, version: 3, events: [], session: u.session, players: u.players, deadlines: u.deadlines });
    expect(updates).toHaveLength(1);
    expect(client.snapshot()?.view.me).toBe(me.id);
    sockets[0].receive({ type: 'error', code: 'not_your_turn' });
    sockets[0].receive({ type: 'error', code: 'room_full' });
    expect(engineErrors).toEqual(['not_your_turn']);
    expect(roomErrors).toEqual(['room_full']);
    client.dispose();
  });

  it('команды до подтверждения входа ждут hello:ok и уходят после него по порядку', () => {
    const client = new SocketGameClient({ url: 'ws://test/ws', auth, connect });
    client.createRoom(room.settings, 3);
    client.startRoom();
    sockets[0].open();
    expect(sockets[0].sent.map((m) => (m as { type: string }).type)).toEqual(['hello']);
    sockets[0].receive({ type: 'hello:ok', me, room: null });
    expect(sockets[0].sent.map((m) => (m as { type: string }).type)).toEqual(['hello', 'room:create', 'room:start']);
    client.dispose();
  });

  it('команды уходят сообщениями протокола', () => {
    const client = new SocketGameClient({ url: 'ws://test/ws', auth, connect });
    sockets[0].open();
    sockets[0].receive({ type: 'hello:ok', me, room: null });
    sockets[0].sent.length = 0;
    client.createRoom(room.settings, 4);
    client.joinRoom(' k7pq ');
    client.startRoom();
    client.send({ type: 'draw' });
    client.nextGame();
    client.endSession();
    expect(sockets[0].sent.map((m) => (m as { type: string }).type)).toEqual(['room:create', 'room:join', 'room:start', 'game:action', 'room:next', 'room:close']);
    expect(sockets[0].sent[1]).toEqual({ type: 'room:join', code: 'K7PQ' });
    client.dispose();
  });

  it('обрыв — переподключение с нарастающей паузой, повторное hello; «вытеснен» — конец', () => {
    const client = new SocketGameClient({ url: 'ws://test/ws', auth, connect });
    const states: string[] = [];
    client.onRoom((s) => states.push(s.connection));
    sockets[0].open();
    sockets[0].receive({ type: 'hello:ok', me, room: null });
    sockets[0].close();
    expect(states.at(-1)).toBe('reconnecting');
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(sockets[1].sent[0]).toMatchObject({ type: 'hello' });
    sockets[1].receive({ type: 'error', code: 'replaced' });
    expect(states.at(-1)).toBe('lost');
    sockets[1].close();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
    client.dispose();
  });

  it('prepareInvite: id из invite:ready, null — если сервер отказал', async () => {
    const client = new SocketGameClient({ url: 'ws://test/ws', auth, connect });
    sockets[0].open();
    sockets[0].receive({ type: 'hello:ok', me, room: null });
    const first = client.prepareInvite();
    expect(sockets[0].sent.at(-1)).toEqual({ type: 'invite:prepare' });
    sockets[0].receive({ type: 'invite:ready', id: 'msg-1' });
    await expect(first).resolves.toBe('msg-1');
    const second = client.prepareInvite();
    sockets[0].receive({ type: 'error', code: 'invite_unavailable' });
    await expect(second).resolves.toBeNull();
    client.dispose();
  });
});
