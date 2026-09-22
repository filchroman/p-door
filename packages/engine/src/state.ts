import type { Card } from './cards';
import type { GameState, PlayerId, PlayerState } from './types';

export function findPlayer(s: GameState, id: PlayerId): PlayerState | undefined {
  return s.players.find((p) => p.id === id);
}

export function seatOrderFrom(s: GameState, id: PlayerId): PlayerId[] {
  const start = s.players.findIndex((p) => p.id === id);
  return s.players.map((_, i) => s.players[(start + i) % s.players.length].id);
}

export function nextActive(s: GameState, id: PlayerId): PlayerId {
  for (const other of seatOrderFrom(s, id).slice(1)) {
    if (!findPlayer(s, other)!.out) return other;
  }
  return id;
}

export function activePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => !p.out);
}

export function stackTop(p: PlayerState): Card | undefined {
  return p.stack[p.stack.length - 1];
}
