import { z } from 'zod';

/** Сообщения клиент ↔ сервер (спека онлайн §4). Схемы — единственная валидация на входе сервера. */

const card = z.object({ rank: z.number().int().min(2).max(14), suit: z.enum(['C', 'D', 'H', 'S']) });
const playerId = z.string().min(1).max(64);

export const settingsSchema = z.object({
  deckSize: z.union([z.literal(36), z.literal(52)]),
  turnSeconds: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]),
  stallRule: z.enum(['forcedVidbiy', 'endGame']),
});

/** Намерение игрока: любое действие движка, кроме служебного `tick`. */
export const intentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('moveOwnTop'), to: playerId }),
  z.object({ type: z.literal('draw') }),
  z.object({ type: z.literal('placeDrawn'), to: playerId }),
  z.object({ type: z.literal('callVakhta') }),
  z.object({ type: z.literal('givePenalty'), to: playerId, card }),
  z.object({ type: z.literal('play'), card }),
  z.object({ type: z.literal('take') }),
  z.object({ type: z.literal('surrender') }),
]);

export const authSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('telegram'), initData: z.string().min(1).max(8192) }),
  z.object({ kind: z.literal('anon'), token: z.string().min(8).max(128), nick: z.string().max(32) }),
]);

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), auth: authSchema, room: z.string().max(8).optional() }),
  z.object({ type: z.literal('room:create'), settings: settingsSchema, playerCount: z.number().int().min(2).max(6) }),
  z.object({ type: z.literal('room:join'), code: z.string().min(1).max(8) }),
  z.object({ type: z.literal('room:leave') }),
  z.object({ type: z.literal('room:settings'), settings: settingsSchema, playerCount: z.number().int().min(2).max(6) }),
  z.object({ type: z.literal('room:fillBots'), on: z.boolean() }),
  z.object({ type: z.literal('room:start') }),
  z.object({ type: z.literal('room:next') }),
  z.object({ type: z.literal('room:close') }),
  z.object({ type: z.literal('game:action'), action: intentSchema, version: z.number().int().nonnegative() }),
  /** Подготовить приглашение в текущую комнату: сообщение с кнопкой, которое Telegram отправит другу. */
  z.object({ type: z.literal('invite:prepare') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type Auth = z.infer<typeof authSchema>;

export type RoomStatus = 'lobby' | 'playing' | 'closed';

export interface RoomSeat {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  /** Подключён ли сейчас (для плашки «переподключается»). */
  online: boolean;
}

export interface RoomState {
  code: string;
  hostId: string;
  seats: RoomSeat[];
  playerCount: number;
  settings: z.infer<typeof settingsSchema>;
  fillBots: boolean;
  status: RoomStatus;
  /** Счёт поражений за сессию — виден и в лобби между партиями. */
  losses: Record<string, number>;
  gameNumber: number;
}

export interface Me {
  id: string;
  name: string;
  avatar: string;
}

export type ServerErrorCode =
  | 'bad_auth'
  | 'bad_message'
  | 'no_room'
  | 'room_full'
  | 'not_host'
  | 'already_playing'
  | 'not_in_room'
  | 'too_few_players'
  | 'not_enough_cards'
  | 'replaced'
  | 'wrong_phase'
  | 'not_your_turn'
  | 'illegal_move'
  | 'unknown_player'
  | 'card_not_in_hand'
  | 'nothing_to_call'
  | 'invite_unavailable';

export type ServerMessage =
  | { type: 'hello:ok'; me: Me; room: RoomState | null }
  | { type: 'room:state'; room: RoomState }
  | { type: 'room:left' }
  | {
      type: 'game:view';
      view: import('@vakhta/engine').PlayerView;
      version: number;
      events: import('@vakhta/engine').GameEvent[];
      session: import('./index').SessionSummary;
      players: import('./index').SeatInfo[];
      deadlines: import('./index').Deadlines;
    }
  | { type: 'invite:ready'; id: string }
  | { type: 'error'; code: ServerErrorCode; message?: string };
