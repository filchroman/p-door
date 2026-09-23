import { pendingPlayers } from '@vakhta/engine';
import { fakeClock, runUntil } from '@vakhta/host/testing';
import { mulberry32 } from '@vakhta/engine';
import type { MatchSettings, Me } from '@vakhta/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AWAY_AFTER_MS, HOLD_SEAT_MS, Room } from '../src/rooms/Room';
import { CODE_ALPHABET, CODE_LENGTH, EMPTY_ROOM_TTL_MS, RoomManager } from '../src/rooms/RoomManager';

const settings: MatchSettings = { deckSize: 36, turnSeconds: 0, stallRule: 'forcedVidbiy' };
const roma: Me = { id: 'tg:1', name: 'Рома', avatar: 'https://t.me/i/1.jpg' };
const galya: Me = { id: 'tg:2', name: 'Галя', avatar: '🦊' };

beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => vi.useRealTimers());

const makeRoom = (playerCount = 3) => new Room('K7PQ', roma, settings, playerCount, fakeClock, mulberry32(7));

describe('Room: лобби', () => {
  it('создатель — хост; друзья входят по коду, полная комната не пускает', () => {
    const room = makeRoom(2);
    expect(room.state()).toMatchObject({ code: 'K7PQ', hostId: 'tg:1', status: 'lobby', playerCount: 2 });
    expect(room.join(galya)).toBeNull();
    expect(room.join({ id: 'tg:3', name: 'Люся', avatar: '🐱' })).toBe('room_full');
    expect(room.state().seats.map((s) => s.name)).toEqual(['Рома', 'Галя']);
  });

  it('настройки и «добить ботами» меняет только хост', () => {
    const room = makeRoom();
    room.join(galya);
    expect(room.configure('tg:2', { ...settings, deckSize: 52 }, 4)).toBe('not_host');
    expect(room.configure('tg:1', { ...settings, deckSize: 52 }, 4)).toBeNull();
    expect(room.state()).toMatchObject({ playerCount: 4, settings: { deckSize: 52 } });
    expect(room.setFillBots('tg:1', false)).toBeNull();
    expect(room.state().fillBots).toBe(false);
  });

  it('старт: люди плюс боты до числа мест; без ботов одному не стартовать', () => {
    const room = makeRoom(3);
    expect(room.setFillBots('tg:1', false)).toBeNull();
    expect(room.start('tg:1')).toBe('too_few_players');
    room.setFillBots('tg:1', true);
    expect(room.start('tg:1')).toBeNull();
    const state = room.state();
    expect(state.status).toBe('playing');
    expect(state.seats.map((s) => [s.name, s.isBot])).toEqual([['Рома', false], ['Боря', true], ['Галя', true]]);
    expect(room.viewMessage('tg:1')).toMatchObject({ type: 'game:view', version: expect.any(Number) });
  });
});

describe('Room: партия и связь', () => {
  it('срез каждому свой: зритель без руки, чужие руки никому не уходят', () => {
    const room = makeRoom(2);
    room.join(galya);
    room.start('tg:1');
    room.join({ id: 'tg:9', name: 'Зритель', avatar: '👀' });
    const mine = room.viewMessage('tg:1')!;
    const theirs = room.viewMessage('tg:9')!;
    expect(mine.type === 'game:view' && mine.view.me).toBe('tg:1');
    expect(theirs.type === 'game:view' && theirs.view.myHand).toEqual([]);
    expect(JSON.stringify(mine)).not.toContain('"hand"');
  });

  it('ход принимает только рассаженный участник', () => {
    const room = makeRoom(2);
    room.join(galya);
    room.start('tg:1');
    expect(room.act('tg:9', { type: 'draw' })).toEqual({ ok: false, error: 'wrong_phase' });
    const view = room.viewMessage('tg:1')!;
    const turn = view.type === 'game:view' ? view.view.turn : '';
    expect(room.act(turn, { type: 'draw' })).toEqual({ ok: true });
  });

  it('пропавший со связи: через минуту за него ходит автоход, вернулся — снова сам', () => {
    const room = makeRoom(2);
    room.join(galya);
    room.start('tg:1');
    room.setOnline('tg:2', false);
    expect(room.state().seats.find((s) => s.id === 'tg:2')!.online).toBe(false);
    expect(room.game!.isAway('tg:2')).toBe(false);
    vi.advanceTimersByTime(AWAY_AFTER_MS);
    expect(room.game!.isAway('tg:2')).toBe(true);
    room.setOnline('tg:2', true);
    expect(room.game!.isAway('tg:2')).toBe(false);
  });

  it('не вернулся за 5 минут — техническое поражение и место освобождается', () => {
    const room = makeRoom(2);
    room.join(galya);
    room.start('tg:1');
    room.setOnline('tg:2', false);
    vi.advanceTimersByTime(HOLD_SEAT_MS);
    expect(room.members.has('tg:2')).toBe(false);
    expect(room.game!.getSummary()).toMatchObject({ status: 'gameOver', losses: { 'tg:2': 1 } });
  });

  it('партия ботов и людей на автоходе доигрывается до конца; «ещё партия» и «закрыть вечер» — у хоста', () => {
    const room = makeRoom(3);
    room.start('tg:1');
    room.game!.setAutopilot(true);
    runUntil(() => room.game!.getStatus() !== 'playing');
    expect(room.game!.getStatus()).toBe('gameOver');
    expect(room.next('tg:2')).toBe('not_host');
    expect(room.next('tg:1')).toBeNull();
    expect(room.game!.getSummary().gameNumber).toBe(2);
    expect(room.close('tg:1')).toBeNull();
    expect(room.state().status).toBe('lobby');
    expect(room.game!.getStatus()).toBe('sessionOver');
    void pendingPlayers;
  });

  it('уход хоста передаёт права следующему', () => {
    const room = makeRoom(3);
    room.join(galya);
    room.leave('tg:1');
    expect(room.hostId).toBe('tg:2');
  });
});

describe('RoomManager', () => {
  it('выдаёт уникальные читаемые коды и находит комнату без учёта регистра', () => {
    const manager = new RoomManager(fakeClock, mulberry32(1));
    const room = manager.create(roma, settings, 3);
    expect(room.code).toHaveLength(CODE_LENGTH);
    expect([...room.code].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    expect(manager.get(room.code.toLowerCase())).toBe(room);
    expect(manager.roomOf('tg:1')).toBe(room);
  });

  it('пустая комната удаляется через 30 минут, если никто не вернулся', () => {
    const manager = new RoomManager(fakeClock, mulberry32(2));
    const room = manager.create(roma, settings, 3);
    room.leave('tg:1');
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_MS - 1);
    expect(manager.get(room.code)).toBe(room);
    vi.advanceTimersByTime(1);
    expect(manager.get(room.code)).toBeNull();
  });
});
