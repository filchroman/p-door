import type { AddressInfo } from 'node:net';
import type { ServerMessage } from '@vakhta/protocol';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app';
import { signInitData } from '../src/auth/telegram';

const TOKEN = '123456:TEST-TOKEN';
let built: BuiltApp;
let url = '';

/** Клиент-обёртка: очередь входящих сообщений и ожидание нужного. */
class Client {
  readonly inbox: ServerMessage[] = [];
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor(readonly socket: WebSocket) {
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      this.inbox.push(message);
      for (const w of this.waiters.splice(0)) w(message);
    });
  }
  static async open(): Promise<Client> {
    const socket = new WebSocket(url);
    await new Promise((resolve) => socket.once('open', resolve));
    return new Client(socket);
  }
  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }
  /** Ждёт сообщение нужного типа (уже пришедшее тоже считается). */
  async next<T extends ServerMessage['type']>(type: T, timeoutMs = 3000): Promise<Extract<ServerMessage, { type: T }>> {
    const found = this.inbox.find((m) => m.type === type);
    if (found) {
      this.inbox.splice(this.inbox.indexOf(found), 1);
      return found as Extract<ServerMessage, { type: T }>;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${type} in ${timeoutMs} ms`)), timeoutMs);
      const check = (m: ServerMessage) => {
        if (m.type !== type) return this.waiters.push(check);
        clearTimeout(timer);
        this.inbox.splice(this.inbox.indexOf(m), 1);
        resolve(m as Extract<ServerMessage, { type: T }>);
      };
      this.waiters.push(check);
    });
  }
  close(): void {
    this.socket.close();
  }
}

function telegramInitData(id: number, name: string, startParam?: string): string {
  const pairs: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: name, photo_url: `https://t.me/i/${id}.jpg` }),
  };
  if (startParam) pairs.start_param = startParam;
  pairs.hash = signInitData(pairs, TOKEN);
  return new URLSearchParams(pairs).toString();
}

const anon = (token: string, nick: string) => ({ kind: 'anon' as const, token, nick });
const settings = { deckSize: 36 as const, turnSeconds: 0 as const, stallRule: 'forcedVidbiy' as const };

beforeEach(async () => {
  built = buildApp({ botToken: TOKEN, botUsername: 'vakhta_bot', appShortName: 'game', webDist: '' });
  await built.app.listen({ port: 0, host: '127.0.0.1' });
  url = `ws://127.0.0.1:${(built.app.server.address() as AddressInfo).port}/ws`;
});
afterEach(async () => {
  await built.app.close();
});

describe('шлюз', () => {
  it('вход через Telegram: имя и фото из initData; подделка отвергается', async () => {
    const roma = await Client.open();
    roma.send({ type: 'hello', auth: { kind: 'telegram', initData: telegramInitData(1, 'Рома') } });
    const ok = await roma.next('hello:ok');
    expect(ok.me).toEqual({ id: 'tg:1', name: 'Рома', avatar: 'https://t.me/i/1.jpg' });
    expect(ok.room).toBeNull();
    const fake = await Client.open();
    fake.send({ type: 'hello', auth: { kind: 'telegram', initData: telegramInitData(1, 'Рома').replace(/hash=[0-9a-f]+/, 'hash=00') } });
    expect((await fake.next('error')).code).toBe('bad_auth');
    roma.close();
    fake.close();
  });

  it('создать комнату, войти по коду, стартовать и сделать ход; срезы у каждого свои', async () => {
    const roma = await Client.open();
    roma.send({ type: 'hello', auth: anon('roma-token-0001', 'Рома') });
    await roma.next('hello:ok');
    roma.send({ type: 'room:create', settings, playerCount: 2 });
    const { room } = await roma.next('room:state');
    expect(room.hostId).toBe('anon:roma-token-0001');

    const galya = await Client.open();
    galya.send({ type: 'hello', auth: anon('galya-token-0001', 'Галя') });
    await galya.next('hello:ok');
    galya.send({ type: 'room:join', code: room.code.toLowerCase() });
    const joined = await galya.next('room:state');
    expect(joined.room.seats.map((s) => s.name)).toEqual(['Рома', 'Галя']);
    // Хост тоже узнал о новом участнике.
    expect((await roma.next('room:state')).room.seats).toHaveLength(2);

    galya.send({ type: 'room:start' });
    expect((await galya.next('error')).code).toBe('not_host');
    roma.send({ type: 'room:start' });
    const mine = await roma.next('game:view');
    const theirs = await galya.next('game:view');
    expect(mine.view.me).toBe('anon:roma-token-0001');
    expect(theirs.view.me).toBe('anon:galya-token-0001');
    expect(mine.players.map((p) => p.isBot)).toEqual([false, false]);

    const mover = mine.view.turn === mine.view.me ? roma : galya;
    const other = mover === roma ? galya : roma;
    other.send({ type: 'game:action', action: { type: 'draw' }, version: 0 });
    expect((await other.next('error')).code).toBe('not_your_turn');
    mover.send({ type: 'game:action', action: { type: 'draw' }, version: 0 });
    const after = await mover.next('game:view');
    expect(after.events.some((e) => e.type === 'drew')).toBe(true);
    // Соперник видит, что карта вытянута, но не видит чужих рук.
    const seen = await other.next('game:view');
    expect(seen.view.drawn).not.toBeNull();
    expect(JSON.stringify(seen)).not.toContain('"hand"');
    roma.close();
    galya.close();
  });

  it('ссылка-приглашение: start_param ведёт прямо в комнату; повторный вход возвращает место', async () => {
    const roma = await Client.open();
    roma.send({ type: 'hello', auth: { kind: 'telegram', initData: telegramInitData(1, 'Рома') } });
    await roma.next('hello:ok');
    roma.send({ type: 'room:create', settings, playerCount: 3 });
    const { room } = await roma.next('room:state');

    const galya = await Client.open();
    galya.send({ type: 'hello', auth: { kind: 'telegram', initData: telegramInitData(2, 'Галя', room.code) } });
    const ok = await galya.next('hello:ok');
    expect(ok.room?.code).toBe(room.code);
    expect(ok.room?.seats.map((s) => s.name)).toEqual(['Рома', 'Галя']);

    // Обрыв и новое подключение того же игрока: место на месте, статус «на связи».
    galya.close();
    const back = await Client.open();
    back.send({ type: 'hello', auth: { kind: 'telegram', initData: telegramInitData(2, 'Галя') } });
    const again = await back.next('hello:ok');
    expect(again.room?.seats.find((s) => s.id === 'tg:2')?.online).toBe(true);
    back.close();
    roma.close();
  });

  it('второе подключение вытесняет первое', async () => {
    const first = await Client.open();
    first.send({ type: 'hello', auth: anon('same-token-00001', 'Рома') });
    await first.next('hello:ok');
    const second = await Client.open();
    second.send({ type: 'hello', auth: anon('same-token-00001', 'Рома') });
    await second.next('hello:ok');
    expect((await first.next('error')).code).toBe('replaced');
    second.close();
  });

  it('мусор в сообщении — bad_message, не падение сервера', async () => {
    const c = await Client.open();
    c.socket.send('{not json');
    expect((await c.next('error')).code).toBe('bad_message');
    c.send({ type: 'room:create' });
    expect((await c.next('error')).code).toBe('bad_message');
    c.close();
  });
});
