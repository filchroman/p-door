import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import { clientMessageSchema, type Auth, type ClientMessage, type Me, type ServerErrorCode, type ServerMessage } from '@vakhta/protocol';
import { WebSocket, WebSocketServer } from 'ws';
import { displayName, verifyInitData } from './auth/telegram';
import type { Room } from './rooms/Room';
import type { RoomManager } from './rooms/RoomManager';

export interface GatewayOptions {
  rooms: RoomManager;
  botToken: string;
  /** Запасное имя для игрока без имени. */
  fallbackName: string;
  /** Аватар-заглушка, если у пользователя нет фото. */
  fallbackAvatar: (id: string) => string;
  now?: () => number;
}

interface Session {
  socket: WebSocket;
  me: Me | null;
}

const send = (socket: WebSocket, message: ServerMessage): void => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

/**
 * WebSocket-шлюз: одна сессия на подключение. Первым сообщением — `hello` с данными входа; дальше
 * команды комнаты и ходы. Один игрок — одно подключение: новое вытесняет старое (`replaced`).
 * Каждому участнику комнаты уходит его собственный срез, зрителю — стол без руки.
 */
export class Gateway {
  private readonly wss: WebSocketServer;
  private readonly sessions = new Map<WebSocket, Session>();
  private readonly byPlayer = new Map<string, WebSocket>();
  private readonly watched = new Set<Room>();

  constructor(
    server: Server,
    private readonly options: GatewayOptions,
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket) => this.onConnection(socket));
  }

  close(): void {
    for (const socket of this.sessions.keys()) socket.close();
    this.wss.close();
  }

  private onConnection(socket: WebSocket): void {
    const session: Session = { socket, me: null };
    this.sessions.set(socket, session);
    socket.on('message', (raw) => this.onMessage(session, raw.toString()));
    socket.on('close', () => this.onClose(session));
  }

  private onMessage(session: Session, raw: string): void {
    let parsed: ClientMessage;
    try {
      const result = clientMessageSchema.safeParse(JSON.parse(raw));
      if (!result.success) return this.fail(session, 'bad_message');
      parsed = result.data;
    } catch {
      return this.fail(session, 'bad_message');
    }
    if (parsed.type === 'hello') return this.hello(session, parsed.auth, parsed.room ?? null);
    const me = session.me;
    if (!me) return this.fail(session, 'bad_auth');
    const { rooms } = this.options;
    const room = rooms.roomOf(me.id);
    switch (parsed.type) {
      case 'room:create': {
        if (room) room.leave(me.id);
        const created = rooms.create(me, parsed.settings, parsed.playerCount);
        this.watch(created);
        return send(session.socket, { type: 'room:state', room: created.state() });
      }
      case 'room:join': {
        const target = rooms.get(parsed.code);
        if (!target) return this.fail(session, 'no_room');
        if (room && room !== target) room.leave(me.id);
        const error = target.join(me);
        if (error) return this.fail(session, error);
        this.watch(target);
        send(session.socket, { type: 'room:state', room: target.state() });
        const view = target.viewMessage(me.id);
        if (view) send(session.socket, view);
        return;
      }
      case 'room:leave':
        room?.leave(me.id);
        return send(session.socket, { type: 'room:left' });
      case 'room:settings':
        return this.fail(session, room ? room.configure(me.id, parsed.settings, parsed.playerCount) : 'not_in_room');
      case 'room:fillBots':
        return this.fail(session, room ? room.setFillBots(me.id, parsed.on) : 'not_in_room');
      case 'room:start':
        return this.fail(session, room ? room.start(me.id) : 'not_in_room');
      case 'room:next':
        return this.fail(session, room ? room.next(me.id) : 'not_in_room');
      case 'room:close':
        return this.fail(session, room ? room.close(me.id) : 'not_in_room');
      case 'game:action': {
        if (!room) return this.fail(session, 'not_in_room');
        const result = room.act(me.id, parsed.action);
        if (!result.ok) this.fail(session, result.error);
        return;
      }
    }
  }

  private hello(session: Session, auth: Auth, roomCode: string | null): void {
    const me = this.identify(auth);
    if (!me) return this.fail(session, 'bad_auth');
    // Второе подключение того же игрока вытесняет первое: место одно.
    const previous = this.byPlayer.get(me.id);
    if (previous && previous !== session.socket) {
      const old = this.sessions.get(previous);
      if (old) old.me = null;
      send(previous, { type: 'error', code: 'replaced' });
      previous.close();
    }
    session.me = me;
    this.byPlayer.set(me.id, session.socket);
    const { rooms } = this.options;
    let room = rooms.roomOf(me.id);
    const wanted = roomCode ?? (auth.kind === 'telegram' ? (verifyInitData(auth.initData, this.options.botToken, this.options.now?.())?.startParam ?? null) : null);
    if (wanted) {
      const target = rooms.get(wanted);
      if (target && target !== room) {
        room?.leave(me.id);
        if (target.join(me) === null) room = target;
      }
    }
    if (room) {
      room.setOnline(me.id, true);
      this.watch(room);
    }
    send(session.socket, { type: 'hello:ok', me, room: room?.state() ?? null });
    const view = room?.viewMessage(me.id);
    if (view) send(session.socket, view);
  }

  private identify(auth: Auth): Me | null {
    const { fallbackName, fallbackAvatar } = this.options;
    if (auth.kind === 'anon') {
      const id = `anon:${auth.token}`;
      return { id, name: auth.nick.trim() || fallbackName, avatar: fallbackAvatar(id) };
    }
    const verified = verifyInitData(auth.initData, this.options.botToken, this.options.now?.());
    if (!verified) return null;
    const id = `tg:${verified.user.id}`;
    return { id, name: displayName(verified.user, fallbackName), avatar: verified.user.photoUrl || fallbackAvatar(id) };
  }

  private onClose(session: Session): void {
    this.sessions.delete(session.socket);
    const me = session.me;
    if (!me || this.byPlayer.get(me.id) !== session.socket) return;
    this.byPlayer.delete(me.id);
    this.options.rooms.roomOf(me.id)?.setOnline(me.id, false);
  }

  /** Подписка на комнату один раз: срезы уходят всем её участникам, которые сейчас на связи. */
  private watch(room: Room): void {
    if (this.watched.has(room)) return;
    this.watched.add(room);
    room.subscribe((event) => {
      if (event.type === 'left') {
        const socket = this.byPlayer.get(event.id);
        if (socket) send(socket, { type: 'room:left' });
        return;
      }
      for (const id of room.members.keys()) {
        const socket = this.byPlayer.get(id);
        if (!socket) continue;
        if (event.type === 'room') send(socket, { type: 'room:state', room: room.state() });
        else {
          const view = room.viewMessage(id);
          if (view) send(socket, view);
        }
      }
    });
  }

  private fail(session: Session, code: ServerErrorCode | null): void {
    if (code) send(session.socket, { type: 'error', code });
  }
}

/** Только для тестов: сколько сессий сейчас открыто. */
export function openSockets(gateway: Gateway): number {
  return (gateway as unknown as { sessions: Map<unknown, unknown> }).sessions.size;
}

export type { IncomingMessage };
