import { sameCard, type Card } from './cards';
import { canBeat } from './combat';
import { checkGameOver, finish, markOut } from './result';
import { activePlayers, findPlayer, nextActive, seatOrderFrom } from './state';
import type { Action, ErrorCode, GameEvent, GameState, PlayerId, PlayerState } from './types';

/** Столько полных кругов подряд без побития — и срабатывает правило затяжного боя. */
export const STALL_CIRCLES = 2;

export function applyPhase2(s: GameState, p: PlayerState, action: Action, events: GameEvent[]): ErrorCode | null {
  if (action.type !== 'play' && action.type !== 'take') return 'wrong_phase';
  if (s.turn !== p.id) return 'not_your_turn';
  const isBeat = action.type === 'play' && s.table.length > 0;
  const error = action.type === 'play' ? play(s, p, action.card, events) : take(s, p, events);
  if (error) return error;
  s.quietActions = isBeat ? 0 : s.quietActions + 1;
  settleTurn(s, events);
  if (s.phase === 'phase2' && s.quietActions >= STALL_CIRCLES * activePlayers(s).length) resolveStall(s, p.id, events);
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
  s.quietActions = 0;
  events.push({ type: 'stall', rule: s.stallRule });
  if (s.stallRule === 'forcedVidbiy') {
    const before = progressMark(s);
    vidbiy(s, lastActorId, events);
    settleTurn(s, events);
    if (s.phase !== 'phase2' || progressMark(s) !== before) return;
  }
  endByCardCount(s, toMove, events);
}

/** Меняется, только если принудительный отбой что-то сделал: ушли карты, кто-то вышел или открыл прикуп. */
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
