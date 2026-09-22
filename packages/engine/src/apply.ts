import { applyPhase1 } from './phase1';
import { findPlayer } from './state';
import type { Action, ApplyResult, ErrorCode, GameEvent, GameState, PlayerId } from './types';
import { callVakhta, isWatchOpen } from './vakhta';

export function apply(state: GameState, playerId: PlayerId, action: Action, now: number): ApplyResult {
  if (state.phase === 'over') return { ok: false, error: 'wrong_phase' };
  const s = structuredClone(state);
  const events: GameEvent[] = [];
  s.watches = s.watches.filter((w) => isWatchOpen(w, now));
  const error = dispatch(s, playerId, action, now, events);
  if (error) return { ok: false, error };
  return { ok: true, state: s, events };
}

function dispatch(s: GameState, playerId: PlayerId, action: Action, now: number, events: GameEvent[]): ErrorCode | null {
  if (action.type === 'tick') return null;
  const p = findPlayer(s, playerId);
  if (!p) return 'unknown_player';
  if (action.type === 'callVakhta') return callVakhta(s, p, now, events);
  if (s.phase === 'phase1') return applyPhase1(s, p, action, now, events);
  return 'wrong_phase';
}
