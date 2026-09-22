import { cardToString, sameCard, type Card } from './cards';
import { canBeat } from './combat';
import { checkGameOver, finish, markOut } from './result';
import { activePlayers, findPlayer, nextActive, seatOrderFrom } from './state';
import type { Action, ErrorCode, GameEvent, GameState, PlayerId, PlayerState } from './types';

/** Позиция, встреченная столько раз с последнего прогресса, — это затяжной бой. */
export const STALL_REPEATS = 3;

/** Чей ход + стол (карта и кто положил, снизу вверх) + руки не вышедших игроков как множества. */
export function positionKey(s: GameState): string {
  const hands = s.players.map((p) => (p.out ? '-' : p.hand.map(cardToString).sort().join(','))).join('|');
  const table = s.table.map((t) => `${cardToString(t.card)}${t.by}`).join(',');
  return `${s.turn}#${table}#${hands}`;
}

/** FNV-1a, 32 бита, hex: история позиций хранит короткие хэши, а не полные ключи. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function positionHash(s: GameState): string {
  return fnv1a(positionKey(s));
}

export function applyPhase2(s: GameState, p: PlayerState, action: Action, events: GameEvent[]): ErrorCode | null {
  if (action.type !== 'play' && action.type !== 'take') return 'wrong_phase';
  if (s.turn !== p.id) return 'not_your_turn';
  const before = progressMark(s);
  const error = action.type === 'play' ? play(s, p, action.card, events) : take(s, p, events);
  if (error) return error;
  settleTurn(s, events);
  if (s.phase !== 'phase2') return null;
  const key = positionHash(s);
  if (progressMark(s) !== before) {
    s.positions = { [key]: 1 };
    return null;
  }
  s.positions[key] = (s.positions[key] ?? 0) + 1;
  if (s.positions[key] >= STALL_REPEATS) resolveStall(s, p.id, events);
  return null;
}

function play(s: GameState, p: PlayerState, card: Card, events: GameEvent[]): ErrorCode | null {
  const index = p.hand.findIndex((x) => sameCard(x, card));
  if (index < 0) return 'card_not_in_hand';
  const top = s.table[s.table.length - 1];
  if (top && !canBeat(card, top.card, s.trump!, s.deckSize)) return 'illegal_move';
  p.hand.splice(index, 1);
  s.table.push({ card, by: p.id });
  events.push({ type: 'played', playerId: p.id, card });
  if (s.table.length === activePlayers(s).length) vidbiy(s, p.id, events);
  else s.turn = nextActive(s, p.id);
  return null;
}

function take(s: GameState, p: PlayerState, events: GameEvent[]): ErrorCode | null {
  const bottom = s.table.shift();
  if (!bottom) return 'illegal_move';
  p.hand.push(bottom.card);
  events.push({ type: 'tookBottom', playerId: p.id, card: bottom.card });
  s.turn = nextActive(s, p.id);
  return null;
}

function vidbiy(s: GameState, closerId: PlayerId, events: GameEvent[]): void {
  s.discard.push(...s.table.map((t) => t.card));
  s.table = [];
  events.push({ type: 'vidbiy', closerId });
  for (const id of seatOrderFrom(s, closerId)) {
    const pl = findPlayer(s, id)!;
    if (!pl.out && pl.hand.length === 0) unlockOrExit(s, pl, events);
  }
  if (checkGameOver(s, events)) return;
  s.turn = findPlayer(s, closerId)!.out ? nextActive(s, closerId) : closerId;
}

function unlockOrExit(s: GameState, p: PlayerState, events: GameEvent[]): void {
  if (p.prykup.length > 0) {
    p.hand = p.prykup;
    p.prykup = [];
    events.push({ type: 'prykupOpened', playerId: p.id });
  } else {
    markOut(s, p, events);
  }
}

/** Пустая рука и пустой стол в свой ход — это отбой для этого игрока. */
export function settleTurn(s: GameState, events: GameEvent[]): void {
  while (s.phase === 'phase2') {
    const p = findPlayer(s, s.turn)!;
    if (p.hand.length > 0 || s.table.length > 0) return;
    unlockOrExit(s, p, events);
    if (!p.out) return;
    if (checkGameOver(s, events)) return;
    s.turn = nextActive(s, p.id);
  }
}

function resolveStall(s: GameState, lastActorId: PlayerId, events: GameEvent[]): void {
  const toMove = s.turn;
  events.push({ type: 'stall', rule: s.stallRule });
  if (s.stallRule === 'forcedVidbiy') {
    const before = progressMark(s);
    vidbiy(s, lastActorId, events);
    settleTurn(s, events);
    if (s.phase === 'phase2' && progressMark(s) === before) endByCardCount(s, toMove, events);
  } else {
    endByCardCount(s, toMove, events);
  }
  s.positions = s.phase === 'phase2' ? { [positionHash(s)]: 1 } : {};
}

/** Прогресс: ушли карты в отбой, кто-то вышел или открыл прикуп. */
function progressMark(s: GameState): string {
  const prykups = s.players.reduce((n, p) => n + p.prykup.length, 0);
  return `${s.discard.length}/${s.outOrder.length}/${prykups}`;
}

function endByCardCount(s: GameState, toMove: PlayerId, events: GameEvent[]): void {
  const cardsOf = (id: PlayerId) => {
    const pl = findPlayer(s, id)!;
    return pl.hand.length + pl.prykup.length;
  };
  const active = seatOrderFrom(s, toMove).filter((id) => !findPlayer(s, id)!.out);
  const most = Math.max(...active.map(cardsOf));
  const loserId = active.find((id) => cardsOf(id) === most)!;
  finish(s, { loserId, winnerId: s.outOrder[0] ?? null, outOrder: [...s.outOrder], technical: false }, events);
}
