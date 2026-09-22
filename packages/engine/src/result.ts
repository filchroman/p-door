import { activePlayers } from './state';
import type { ErrorCode, GameEvent, GameResult, GameState, PlayerState } from './types';

export function markOut(s: GameState, p: PlayerState, events: GameEvent[]): void {
  p.out = true;
  s.outOrder.push(p.id);
  events.push({ type: 'out', playerId: p.id });
}

export function checkGameOver(s: GameState, events: GameEvent[]): boolean {
  const active = activePlayers(s);
  if (active.length > 1) return false;
  finish(s, { loserId: active[0]?.id ?? null, winnerId: s.outOrder[0] ?? null, outOrder: [...s.outOrder], technical: false }, events);
  return true;
}

export function surrender(s: GameState, p: PlayerState, events: GameEvent[]): ErrorCode | null {
  if (p.out) return 'illegal_move';
  finish(s, { loserId: p.id, winnerId: s.outOrder[0] ?? null, outOrder: [...s.outOrder], technical: true }, events);
  return null;
}

function finish(s: GameState, result: GameResult, events: GameEvent[]): void {
  s.result = result;
  s.phase = 'over';
  s.watches = [];
  s.debts = [];
  events.push({ type: 'gameOver', result });
}
