import { makeDeck, type Card, type DeckSize } from './cards';
import { mulberry32, shuffle } from './rng';
import type { GameState, PlayerId, PlayerState, StallRule } from './types';

export interface GameSetup {
  deckSize: DeckSize;
  playerIds: PlayerId[]; // порядок мест по часовой
  prykupSizes: Record<PlayerId, number>;
  dealerId: PlayerId;
  previousWinnerId: PlayerId | null;
  seed: number;
  stallRule?: StallRule;
}

/** После прикупов и открытых карт в колоде должно остаться не меньше карт, чем игроков. */
export function canDeal(deckSize: DeckSize, prykupSizes: number[]): boolean {
  const n = prykupSizes.length;
  const used = prykupSizes.reduce((a, b) => a + b, 0) + n;
  return deckSize - used >= n;
}

export function createGame(setup: GameSetup): GameState {
  const { playerIds } = setup;
  if (playerIds.length < 2 || playerIds.length > 6) throw new Error('bad_player_count');
  if (!canDeal(setup.deckSize, playerIds.map((id) => setup.prykupSizes[id]))) throw new Error('not_enough_cards');

  const deck = shuffle(makeDeck(setup.deckSize), mulberry32(setup.seed));
  const players: PlayerState[] = playerIds.map((id) => ({ id, prykup: [], stack: [], hand: [], fouls: 0, out: false }));
  for (const p of players) p.prykup = deck.splice(0, setup.prykupSizes[p.id]);
  const openDeal: Card[] = [];
  for (const p of players) {
    const card = deck.shift()!;
    p.stack.push(card);
    openDeal.push(card);
  }

  return {
    deckSize: setup.deckSize,
    players,
    phase: 'phase1',
    turn: setup.dealerId,
    deck,
    drawn: null,
    drawHistory: [],
    openDeal,
    trump: null,
    lastCardDrawerId: null,
    previousWinnerId: setup.previousWinnerId,
    watches: [],
    nextWatchId: 1,
    debts: [],
    table: [],
    discard: [],
    outOrder: [],
    result: null,
    stallRule: setup.stallRule ?? 'forcedVidbiy',
    quietActions: 0,
    idleActions: 0,
  };
}
