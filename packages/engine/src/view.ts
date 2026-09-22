import type { Card, DeckSize, Suit } from './cards';
import { findPlayer, stackTop } from './state';
import type { GameResult, GameState, Phase, PlayerId, TableCard } from './types';
import { isWatchOpen } from './vakhta';

export interface PublicPlayer {
  id: PlayerId;
  prykupCount: number;
  stackTop: Card | null;
  stackCount: number;
  handCount: number;
  fouls: number;
  out: boolean;
}

export interface PlayerView {
  me: PlayerId;
  phase: Phase;
  turn: PlayerId;
  deckSize: DeckSize;
  deckCount: number;
  drawn: Card | null;
  trump: Suit | null;
  table: TableCard[];
  discardCount: number;
  players: PublicPlayer[];
  myHand: Card[];
  myDebts: { to: PlayerId; count: number }[];
  vakhtaOpen: boolean;
  result: GameResult | null;
}

export function viewFor(s: GameState, playerId: PlayerId, now: number): PlayerView {
  const me = findPlayer(s, playerId);
  const vakhtaPhase = s.phase === 'phase1' || s.phase === 'penalty';
  return {
    me: playerId,
    phase: s.phase,
    turn: s.turn,
    deckSize: s.deckSize,
    deckCount: s.deck.length,
    drawn: s.drawn,
    trump: s.trump,
    table: s.table.map((t) => ({ card: t.card, by: t.by })),
    discardCount: s.discard.length,
    players: s.players.map((p) => ({
      id: p.id,
      prykupCount: p.prykup.length,
      stackTop: stackTop(p) ?? null,
      stackCount: p.stack.length,
      handCount: p.hand.length,
      fouls: p.fouls,
      out: p.out,
    })),
    myHand: me ? [...me.hand] : [],
    myDebts: s.debts.filter((d) => d.from === playerId && d.count > 0).map((d) => ({ to: d.to, count: d.count })),
    vakhtaOpen: vakhtaPhase && s.watches.some((w) => w.playerId !== playerId && isWatchOpen(w, now)),
    result: s.result,
  };
}
