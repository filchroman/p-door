import type { Card } from './cards';
import { canBeat } from './combat';
import { findPlayer } from './state';
import type { GameState, PlayerId } from './types';

export interface LegalMoves {
  playable: Card[];
  canTake: boolean;
}

export function legalMoves(s: GameState, playerId: PlayerId): LegalMoves {
  const p = findPlayer(s, playerId);
  if (s.phase !== 'phase2' || !p || s.turn !== playerId) return { playable: [], canTake: false };
  const top = s.table[s.table.length - 1];
  const playable = top ? p.hand.filter((card) => canBeat(card, top.card, s.trump!, s.deckSize)) : [...p.hand];
  return { playable, canTake: s.table.length > 0 };
}
