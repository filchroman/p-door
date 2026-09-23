import type { ErrorCode, PlayerId } from '@vakhta/engine';
import type { Auth, ClientMessage, Me, RoomState, ServerErrorCode, ServerMessage } from '@vakhta/protocol';
import type { AppClient, ClientUpdate, Intent, MatchSettings } from './types';

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'lost';

/** Что клиент сообщает экранам помимо срезов партии: комната, связь, ошибки комнаты. */
export interface RoomListener {
  (state: { room: RoomState | null; me: Me | null; connection: Connection; left?: boolean }): void;
}

export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface SocketGameClientOptions {
  url: string;
  auth: Auth;
  /** Код комнаты, в которую войти сразу после входа (ссылка-приглашение). */
  room?: string | null;
  connect?: (url: string) => SocketLike;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

/** Ошибки движка сервер присылает теми же кодами — их показываем как и в локальной игре. */
const ENGINE_ERRORS = new Set<ServerErrorCode>(['wrong_phase', 'not_your_turn', 'illegal_move', 'unknown_player', 'card_not_in_hand', 'nothing_to_call']);
const RECONNECT_MS = [1000, 2000, 4000, 8000];

/**
 * Сетевой клиент: тот же `AppClient`, что и локальный, — экраны разницы не видят. Срезы приходят
 * готовыми (`game:view`), комната и связь — отдельным слушателем. Обрыв — переподключение с
 * нарастающей паузой; сервер держит место 5 минут.
 */
export class SocketGameClient implements AppClient {
  private socket: SocketLike | null = null;
  private meId: PlayerId = '';
  private meInfo: Me | null = null;
  private room: RoomState | null = null;
  private connection: Connection = 'connecting';
  private last: ClientUpdate | null = null;
  private attempts = 0;
  private disposed = false;
  private reconnectTimer: unknown = null;
  /** Вход ещё не подтверждён — команды ждут `hello:ok`, а не теряются. */
  private ready = false;
  private readonly pending: ClientMessage[] = [];
  private readonly listeners = new Set<(update: ClientUpdate) => void>();
  private readonly errorListeners = new Set<(code: ErrorCode) => void>();
  private readonly roomListeners = new Set<RoomListener>();
  private readonly roomErrorListeners = new Set<(code: ServerErrorCode) => void>();
  private inviteWaiters: ((id: string | null) => void)[] = [];
  private readonly connect: (url: string) => SocketLike;
  private readonly later: (fn: () => void, ms: number) => unknown;
  private readonly cancel: (handle: unknown) => void;

  constructor(private readonly options: SocketGameClientOptions) {
    this.connect = options.connect ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.later = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancel = options.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.open();
  }

  // ——— AppClient ———

  me(): PlayerId {
    return this.meId;
  }

  subscribe(listener: (update: ClientUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onError(listener: (code: ErrorCode) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  send(intent: Intent): void {
    this.post({ type: 'game:action', action: intent, version: this.last?.view ? 0 : 0 });
  }

  nextGame(): void {
    this.post({ type: 'room:next' });
  }

  endSession(): void {
    this.post({ type: 'room:close' });
  }

  snapshot(): ClientUpdate | null {
    return this.last;
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) this.cancel(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.listeners.clear();
    this.errorListeners.clear();
    this.roomListeners.clear();
    this.roomErrorListeners.clear();
  }

  // ——— комната ———

  onRoom(listener: RoomListener): () => void {
    this.roomListeners.add(listener);
    listener(this.roomSnapshot());
    return () => {
      this.roomListeners.delete(listener);
    };
  }

  onRoomError(listener: (code: ServerErrorCode) => void): () => void {
    this.roomErrorListeners.add(listener);
    return () => {
      this.roomErrorListeners.delete(listener);
    };
  }

  currentRoom(): RoomState | null {
    return this.room;
  }

  createRoom(settings: MatchSettings, playerCount: number): void {
    this.post({ type: 'room:create', settings, playerCount });
  }

  joinRoom(code: string): void {
    this.post({ type: 'room:join', code: code.trim().toUpperCase() });
  }

  leaveRoom(): void {
    this.post({ type: 'room:leave' });
  }

  configureRoom(settings: MatchSettings, playerCount: number): void {
    this.post({ type: 'room:settings', settings, playerCount });
  }

  setFillBots(on: boolean): void {
    this.post({ type: 'room:fillBots', on });
  }

  startRoom(): void {
    this.post({ type: 'room:start' });
  }

  /** Попросить бота подготовить приглашение-сообщение; null — недоступно (нет бота или вход не через Telegram). */
  prepareInvite(): Promise<string | null> {
    return new Promise((resolve) => {
      this.inviteWaiters.push(resolve);
      this.post({ type: 'invite:prepare' });
    });
  }

  // ——— внутреннее ———

  private open(): void {
    if (this.disposed) return;
    const socket = this.connect(this.options.url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      this.post({ type: 'hello', auth: this.options.auth, room: this.options.room ?? undefined });
    };
    socket.onmessage = (event) => this.receive(String(event.data));
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.ready = false;
      if (this.disposed) return;
      this.connection = this.attempts < RECONNECT_MS.length ? 'reconnecting' : 'lost';
      this.emitRoom();
      if (this.connection === 'lost') return;
      this.reconnectTimer = this.later(() => {
        this.reconnectTimer = null;
        this.open();
      }, RECONNECT_MS[this.attempts++]);
    };
    socket.onerror = () => {
      // за ошибкой всегда следует close — там и переподключаемся
    };
  }

  private receive(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case 'hello:ok':
        this.meInfo = message.me;
        this.meId = message.me.id;
        this.room = message.room;
        this.connection = 'live';
        this.ready = true;
        this.emitRoom();
        for (const message of this.pending.splice(0)) this.post(message);
        return;
      case 'room:state':
        this.room = message.room;
        return this.emitRoom();
      case 'room:left':
        this.room = null;
        this.last = null;
        return this.emitRoom(true);
      case 'game:view': {
        const update: ClientUpdate = {
          view: message.view,
          events: message.events,
          session: message.session,
          players: message.players,
          deadlines: message.deadlines,
        };
        this.last = update;
        for (const listener of [...this.listeners]) listener(update);
        return;
      }
      case 'invite:ready':
        for (const waiter of this.inviteWaiters.splice(0)) waiter(message.id);
        return;
      case 'error':
        if (message.code === 'invite_unavailable') {
          for (const waiter of this.inviteWaiters.splice(0)) waiter(null);
          return;
        }
        if (message.code === 'replaced') {
          this.disposed = true;
          this.connection = 'lost';
          return this.emitRoom();
        }
        if (ENGINE_ERRORS.has(message.code)) {
          for (const listener of [...this.errorListeners]) listener(message.code as ErrorCode);
        } else {
          for (const listener of [...this.roomErrorListeners]) listener(message.code);
        }
        return;
    }
  }

  private post(message: ClientMessage): void {
    const socket = this.socket;
    if (message.type !== 'hello' && (!this.ready || !socket || socket.readyState !== 1)) {
      this.pending.push(message);
      return;
    }
    if (!socket || socket.readyState !== 1) return;
    socket.send(JSON.stringify(message));
  }

  private roomSnapshot(left = false) {
    return { room: this.room, me: this.meInfo, connection: this.connection, left };
  }

  private emitRoom(left = false): void {
    const snapshot = this.roomSnapshot(left);
    for (const listener of [...this.roomListeners]) listener(snapshot);
  }
}
