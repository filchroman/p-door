import { isPlusOne, type Card } from './cards';
import { findPlayer, nextActive, seatOrderFrom, stackTop } from './state';
import type { Action, ErrorCode, GameEvent, GameState, PlayerId, PlayerState } from './types';
import { markOthersActed, openWatch } from './vakhta';

export function opponentTargets(s: GameState, card: Card, selfId: PlayerId): PlayerId[] {
  return seatOrderFrom(s, selfId)
    .filter((id) => id !== selfId)
    .filter((id) => {
      const t = stackTop(findPlayer(s, id)!);
      return t !== undefined && isPlusOne(card, t, s.deckSize);
    });
}

export function mustMoveOwnTop(s: GameState, p: PlayerState): boolean {
  return p.stack.length >= 2 && opponentTargets(s, stackTop(p)!, p.id).length > 0;
}

export function applyPhase1(s: GameState, p: PlayerState, action: Action, now: number, events: GameEvent[]): ErrorCode | null {
  if (action.type !== 'moveOwnTop' && action.type !== 'draw' && action.type !== 'placeDrawn') return 'wrong_phase';
  if (s.turn !== p.id) return 'not_your_turn';
  switch (action.type) {
    case 'moveOwnTop':
      return moveOwnTop(s, p, action.to, events);
    case 'draw':
      return draw(s, p, now, events);
    case 'placeDrawn':
      return placeDrawn(s, p, action.to, now, events);
  }
}

function moveOwnTop(s: GameState, p: PlayerState, to: PlayerId, events: GameEvent[]): ErrorCode | null {
  if (s.drawn || p.stack.length < 2) return 'illegal_move';
  const target = findPlayer(s, to);
  if (!target || target.id === p.id) return 'illegal_move';
  const card = stackTop(p)!;
  const targetTop = stackTop(target);
  if (!targetTop || !isPlusOne(card, targetTop, s.deckSize)) return 'illegal_move';
  markOthersActed(s, p.id);
  target.stack.push(p.stack.pop()!);
  events.push({ type: 'movedTop', from: p.id, to, card });
  return null;
}

function draw(s: GameState, p: PlayerState, now: number, events: GameEvent[]): ErrorCode | null {
  if (s.drawn) return 'illegal_move';
  const violated = mustMoveOwnTop(s, p);
  markOthersActed(s, p.id);
  const card = s.deck.shift()!;
  s.drawHistory.push(card);
  openWatch(s, p.id, now, violated);
  events.push({ type: 'drew', playerId: p.id, card });
  s.drawn = card;
  return null;
}

function placeDrawn(s: GameState, p: PlayerState, to: PlayerId, now: number, events: GameEvent[]): ErrorCode | null {
  const card = s.drawn;
  if (!card) return 'illegal_move';
  const target = findPlayer(s, to);
  if (!target) return 'illegal_move';
  const plus = isPlusOne(card, stackTop(target)!, s.deckSize);
  if (target.id !== p.id && !plus) return 'illegal_move';

  markOthersActed(s, p.id);
  target.stack.push(card);
  s.drawn = null;
  if (plus) {
    events.push({ type: 'placed', playerId: p.id, to, card });
    return null;
  }
  openWatch(s, p.id, now, opponentTargets(s, card, p.id).length > 0);
  events.push({ type: 'kept', playerId: p.id, card });
  s.turn = nextActive(s, p.id);
  return null;
}
