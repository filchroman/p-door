import {
  parseCard,
  type Card,
  type DeckSize,
  type GameState,
  type PenaltyDebt,
  type PlayerState,
  type Suit,
  type Watch,
} from '@vakhta/engine';

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
    trumpCard: null,
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

const player = (id: string, fields: Partial<PlayerState>): PlayerState => ({
  id, prykup: [], stack: [], hand: [], fouls: 0, out: false, ...fields,
});

/** stack: снизу вверх; deck: первая карта тянется первой. */
export function phase1State(o: {
  players: { id: string; stack: string; prykup?: string }[];
  deck: string;
  turn?: string;
  drawn?: string;
  deckSize?: DeckSize;
}): GameState {
  const players = o.players.map((p) => player(p.id, { stack: cs(p.stack), prykup: cs(p.prykup ?? '') }));
  return {
    ...baseState(o.deckSize ?? 36),
    players,
    turn: o.turn ?? players[0].id,
    deck: cs(o.deck),
    drawn: o.drawn ? c(o.drawn) : null,
    openDeal: players.map((p) => p.stack[0]),
    nextWatchId: 100,
  };
}

export function penaltyState(o: {
  players: { id: string; hand: string; prykup?: string; fouls?: number }[];
  trump: Suit;
  trumpCard?: string;
  debts?: PenaltyDebt[];
  watches?: Watch[];
  lastCardDrawerId?: string;
}): GameState {
  const players = o.players.map((p) => player(p.id, { hand: cs(p.hand), prykup: cs(p.prykup ?? ''), fouls: p.fouls ?? 0 }));
  return {
    ...baseState(36),
    players,
    phase: 'penalty',
    turn: o.lastCardDrawerId ?? players[0].id,
    trump: o.trump,
    trumpCard: o.trumpCard ? c(o.trumpCard) : null,
    lastCardDrawerId: o.lastCardDrawerId ?? players[0].id,
    debts: o.debts ?? [],
    watches: o.watches ?? [],
    nextWatchId: 100,
  };
}

/** table: [карта, кто положил], снизу вверх. */
export function phase2State(o: {
  players: { id: string; hand: string; prykup?: string; out?: boolean }[];
  trump: Suit;
  trumpCard?: string;
  turn: string;
  table?: [string, string][];
  discard?: string;
}): GameState {
  const players = o.players.map((p) => player(p.id, { hand: cs(p.hand), prykup: cs(p.prykup ?? ''), out: p.out ?? false }));
  return {
    ...baseState(36),
    players,
    phase: 'phase2',
    turn: o.turn,
    trump: o.trump,
    trumpCard: o.trumpCard ? c(o.trumpCard) : null,
    table: (o.table ?? []).map(([card, by]) => ({ card: c(card), by })),
    discard: cs(o.discard ?? ''),
    outOrder: players.filter((p) => p.out).map((p) => p.id),
  };
}
