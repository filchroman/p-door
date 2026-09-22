import { cardToString, makeDeck, type Card, type DeckSize } from './cards';
import { mulberry32, shuffle } from './rng';
import type { GameState, PlayerId, PlayerState, StallRule } from './types';

export interface GameSetup {
  deckSize: DeckSize;
  playerIds: PlayerId[]; // порядок мест по часовой
  prykupSizes: Record<PlayerId, number>;
  dealerId: PlayerId;
  previousWinnerId: PlayerId | null;
  seed: number; // тасует колоду, если `deck` не передан (тесты, фазз)
  stallRule?: StallRule;
  /** Уже перетасованная колода. Прод передаёт её (тасовка через crypto): 32-битный seed подбирается по открытым картам. */
  deck?: Card[];
}

/** Колода — ровно перестановка полной колоды этого размера. */
function isFullDeck(deck: Card[], deckSize: DeckSize): boolean {
  if (deck.length !== deckSize) return false;
  const full = new Set(makeDeck(deckSize).map(cardToString));
  const seen = new Set(deck.map(cardToString));
  return seen.size === deckSize && [...seen].every((card) => full.has(card));
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

  if (setup.deck && !isFullDeck(setup.deck, setup.deckSize)) throw new Error('bad_deck');
  const deck = setup.deck ? setup.deck.map((card) => ({ ...card })) : shuffle(makeDeck(setup.deckSize), mulberry32(setup.seed));
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
    trumpCard: null,
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
    positions: {},
  };
}
