import { describe, expect, it } from 'vitest';
import { cardToString, makeDeck } from '../src/cards';
import { canDeal, createGame, type GameSetup } from '../src/setup';
import { nextActive, seatOrderFrom } from '../src/state';

const setup = (over: Partial<GameSetup> = {}): GameSetup => ({
  deckSize: 36,
  playerIds: ['A', 'B', 'C'],
  prykupSizes: { A: 2, B: 3, C: 2 },
  dealerId: 'B',
  previousWinnerId: null,
  seed: 123,
  ...over,
});

describe('createGame', () => {
  it('deals prykup by size and one open card each', () => {
    const s = createGame(setup());
    expect(s.players.map((p) => p.prykup.length)).toEqual([2, 3, 2]);
    expect(s.players.every((p) => p.stack.length === 1 && p.hand.length === 0)).toBe(true);
    expect(s.openDeal).toHaveLength(3);
    expect(s.deck).toHaveLength(36 - 7 - 3);
    expect(s.phase).toBe('phase1');
    expect(s.turn).toBe('B');
    expect(s.trump).toBeNull();
  });

  it('uses every card exactly once', () => {
    const s = createGame(setup({ deckSize: 52 }));
    const all = [...s.deck, ...s.players.flatMap((p) => [...p.prykup, ...p.stack])].map(cardToString);
    expect(all).toHaveLength(52);
    expect(new Set(all).size).toBe(52);
  });

  it('is deterministic by seed', () => {
    expect(createGame(setup())).toEqual(createGame(setup()));
    expect(createGame(setup()).deck).not.toEqual(createGame(setup({ seed: 124 })).deck);
  });

  it('refuses when the deck is too small or player count is wrong', () => {
    expect(canDeal(36, [2, 2, 2, 2, 2, 2])).toBe(true);
    expect(canDeal(36, [15, 15, 2])).toBe(false);
    expect(() => createGame(setup({ prykupSizes: { A: 15, B: 15, C: 2 } }))).toThrow('not_enough_cards');
    expect(() => createGame(setup({ playerIds: ['A'], prykupSizes: { A: 2 }, dealerId: 'A' }))).toThrow('bad_player_count');
  });
});

describe('createGame with an externally shuffled deck', () => {
  it('deals the given deck in order: prykups, then open cards, the rest is the deck', () => {
    const deck = makeDeck(36).reverse();
    const s = createGame(setup({ deck }));
    expect(s.players.map((p) => p.prykup)).toEqual([deck.slice(0, 2), deck.slice(2, 5), deck.slice(5, 7)]);
    expect(s.players.map((p) => p.stack)).toEqual([[deck[7]], [deck[8]], [deck[9]]]);
    expect(s.openDeal).toEqual(deck.slice(7, 10));
    expect(s.deck).toEqual(deck.slice(10));
    expect(deck).toEqual(makeDeck(36).reverse()); // вход не меняется
  });

  it('rejects a deck that is not a permutation of the full deck', () => {
    const full = makeDeck(36);
    expect(() => createGame(setup({ deck: full.slice(1) }))).toThrow('bad_deck');
    expect(() => createGame(setup({ deck: [full[0], ...full.slice(0, -1)] }))).toThrow('bad_deck');
    expect(() => createGame(setup({ deck: makeDeck(52) }))).toThrow('bad_deck');
    expect(() => createGame(setup({ deck: [{ rank: 2, suit: 'C' }, ...full.slice(1)] }))).toThrow('bad_deck');
  });
});

describe('seat helpers', () => {
  it('walks clockwise and skips players who are out', () => {
    const s = createGame(setup());
    expect(seatOrderFrom(s, 'B')).toEqual(['B', 'C', 'A']);
    expect(nextActive(s, 'C')).toBe('A');
    s.players[0].out = true;
    expect(nextActive(s, 'C')).toBe('B');
  });
});
