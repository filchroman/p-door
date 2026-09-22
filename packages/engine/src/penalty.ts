import { sameCard, type Card } from './cards';
import { positionHash, settleEmptyTable } from './phase2';
import { findPlayer } from './state';
import type { ErrorCode, GameEvent, GameState, PlayerId, PlayerState } from './types';
import { isWatchOpen } from './vakhta';

export function givePenalty(
  s: GameState,
  p: PlayerState,
  action: { to: PlayerId; card: Card },
  events: GameEvent[],
): ErrorCode | null {
  const debt = s.debts.find((d) => d.from === p.id && d.to === action.to && d.count > 0);
  if (!debt) return 'illegal_move';
  const index = p.hand.findIndex((x) => sameCard(x, action.card));
  if (index < 0) return 'card_not_in_hand';
  const [card] = p.hand.splice(index, 1);
  findPlayer(s, action.to)!.hand.push(card);
  debt.count--;
  events.push({ type: 'penaltyGiven', from: p.id, to: action.to });
  return null;
}

export function maybeStartPhase2(s: GameState, now: number, events: GameEvent[]): void {
  if (s.phase !== 'penalty') return;
  s.debts = s.debts.filter((d) => d.count > 0 && findPlayer(s, d.from)!.hand.length > 0);
  if (s.debts.length > 0 || s.watches.some((w) => isWatchOpen(w, now))) return;
  s.phase = 'phase2';
  s.watches = [];
  const winner = s.previousWinnerId && findPlayer(s, s.previousWinnerId) ? s.previousWinnerId : null;
  s.turn = winner ?? s.lastCardDrawerId!;
  events.push({ type: 'phase', phase: 'phase2' });
  settleEmptyTable(s, s.turn, events);
  if (s.phase === 'phase2') s.positions = { [positionHash(s)]: 1 };
}
