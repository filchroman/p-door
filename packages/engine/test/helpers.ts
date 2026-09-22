import { parseCard, type Card, type DeckSize, type Suit } from '../src/cards';
import { apply } from '../src/apply';
import type { Action, GameState, PlayerState, StallRule } from '../src/types';

export const c = parseCard;
export const cs = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(parseCard);

function baseState(deckSize: DeckSize): GameState {
  return {
    deckSize,
    players: [],
    phase: 'phase1',
    turn: '',
    deck: [],
    drawn: null,
    drawHistory: [],
    openDeal: [],
    trump: null,
    lastCardDrawerId: null,
    previousWinnerId: null,
    watches: [],
    nextWatchId: 1,
    debts: [],
    table: [],
    discard: [],
    outOrder: [],
    result: null,
    stallRule: 'forcedVidbiy',
    positions: {},
  };
}

interface P1 { id: string; stack: string; prykup?: string; fouls?: number }

/** stack: снизу вверх, последняя карта — верхняя. deck: первая карта тянется первой. */
export function phase1State(o: { players: P1[]; deck: string; turn?: string; drawn?: string; deckSize?: DeckSize; previousWinnerId?: string }): GameState {
  const players: PlayerState[] = o.players.map((p) => ({
    id: p.id, prykup: cs(p.prykup ?? ''), stack: cs(p.stack), hand: [], fouls: p.fouls ?? 0, out: false,
  }));
  return {
    ...baseState(o.deckSize ?? 36),
    players,
    turn: o.turn ?? players[0].id,
    deck: cs(o.deck),
    drawn: o.drawn ? c(o.drawn) : null,
    openDeal: players.map((p) => p.stack[0]),
    previousWinnerId: o.previousWinnerId ?? null,
  };
}

interface P2 { id: string; hand: string; prykup?: string; out?: boolean }

/** table: [карта, кто положил], снизу вверх. */
export function phase2State(o: { players: P2[]; trump: Suit; turn: string; table?: [string, string][]; deckSize?: DeckSize; stallRule?: StallRule }): GameState {
  const players: PlayerState[] = o.players.map((p) => ({
    id: p.id, prykup: cs(p.prykup ?? ''), stack: [], hand: cs(p.hand), fouls: 0, out: p.out ?? false,
  }));
  return {
    ...baseState(o.deckSize ?? 36),
    players,
    phase: 'phase2',
    turn: o.turn,
    trump: o.trump,
    table: (o.table ?? []).map(([card, by]) => ({ card: c(card), by })),
    outOrder: players.filter((p) => p.out).map((p) => p.id),
    stallRule: o.stallRule ?? 'forcedVidbiy',
  };
}

export function act(s: GameState, id: string, action: Action, now = 0): GameState {
  const r = apply(s, id, action, now);
  if (!r.ok) throw new Error(`${id} ${action.type}: ${r.error}`);
  return r.state;
}

export const pl = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;
export const top = (s: GameState, id: string) => pl(s, id).stack[pl(s, id).stack.length - 1];
