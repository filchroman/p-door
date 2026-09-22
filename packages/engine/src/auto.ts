import { mustMoveOwnTop, opponentTargets } from './phase1';
import { findPlayer, stackTop } from './state';
import type { Action, GameState, PlayerId } from './types';

export function autoAction(s: GameState, playerId: PlayerId, random: () => number = Math.random): Action | null {
  const p = findPlayer(s, playerId);
  if (!p) return null;

  if (s.phase === 'penalty') {
    const debt = s.debts.find((d) => d.from === playerId && d.count > 0);
    if (!debt || p.hand.length === 0) return null;
    return { type: 'givePenalty', to: debt.to, card: p.hand[Math.floor(random() * p.hand.length)] };
  }

  if (s.turn !== playerId) return null;

  if (s.phase === 'phase1') {
    if (s.drawn) return { type: 'placeDrawn', to: opponentTargets(s, s.drawn, playerId)[0] ?? playerId };
    if (mustMoveOwnTop(s, p)) return { type: 'moveOwnTop', to: opponentTargets(s, stackTop(p)!, playerId)[0] };
    return { type: 'draw' };
  }

  if (s.phase === 'phase2') {
    if (s.table.length > 0) return { type: 'take' };
    const byRank = [...p.hand].sort((a, b) => a.rank - b.rank);
    const card = byRank.find((x) => x.suit !== s.trump) ?? byRank[0];
    return card ? { type: 'play', card } : null;
  }

  return null;
}
