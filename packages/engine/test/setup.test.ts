import { describe, expect, it } from 'vitest';
import { cardToString } from '../src/cards';
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
    expect(canDeal(36, [10, 10, 2])).toBe(false);
    expect(() => createGame(setup({ prykupSizes: { A: 10, B: 10, C: 2 } }))).toThrow('not_enough_cards');
    expect(() => createGame(setup({ playerIds: ['A'], prykupSizes: { A: 2 }, dealerId: 'A' }))).toThrow('bad_player_count');
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
