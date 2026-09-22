import { describe, expect, it } from 'vitest';
import {
  apply, autoAction, cardToString, createGame, legalMoves, mulberry32, newSession, recordResult, setupNextGame, shuffle, viewFor,
  type Action, type Card, type DeckSize, type GameState, type PlayerView, type SessionState, type StallRule,
} from '../src';

function allCards(s: GameState): string[] {
  return [
    ...s.deck,
    ...(s.drawn ? [s.drawn] : []),
    ...s.players.flatMap((p) => [...p.prykup, ...p.stack, ...p.hand]),
    ...s.table.map((t) => t.card),
    ...s.discard,
  ].map(cardToString);
}

function expectCardsConserved(s: GameState): void {
  const cards = allCards(s);
  expect(cards).toHaveLength(s.deckSize);
  expect(new Set(cards).size).toBe(s.deckSize);
}

function viewCards(v: PlayerView): Set<string> {
  const cards: Card[] = [...v.myHand, ...v.table.map((t) => t.card), ...(v.drawn ? [v.drawn] : [])];
  for (const p of v.players) if (p.stackTop) cards.push(p.stackTop);
  return new Set(cards.map(cardToString));
}

/** Чужие руки, все прикупы и колода не видны никому. */
function expectHiddenInfoKept(s: GameState, now: number): void {
  for (const p of s.players) {
    const visible = viewCards(viewFor(s, p.id, now));
    const hidden = [
      ...s.players.filter((o) => o.id !== p.id).flatMap((o) => o.hand),
      ...s.players.flatMap((o) => o.prykup),
      ...s.deck,
    ].map(cardToString);
    const leaked = hidden.filter((card) => visible.has(card));
    if (leaked.length) expect(leaked, `${p.id} sees hidden cards`).toEqual([]);
  }
}

function candidates(s: GameState, random: () => number): [string, Action][] {
  const ids = s.players.map((p) => p.id);
  const turn = s.players.find((p) => p.id === s.turn)!;
  const out: [string, Action][] = [];
  if (s.phase === 'phase1') {
    if (random() < 0.1) for (const id of ids) out.push([id, { type: 'callVakhta' }]);
    const moves: [string, Action][] = s.drawn
      ? ids.map((to): [string, Action] => [turn.id, { type: 'placeDrawn', to }])
      : [[turn.id, { type: 'draw' }], ...ids.map((to): [string, Action] => [turn.id, { type: 'moveOwnTop', to }])];
    out.push(...shuffle(moves, random));
  } else if (s.phase === 'penalty') {
    for (const d of s.debts) {
      const from = s.players.find((p) => p.id === d.from)!;
      if (from.hand.length) out.push([d.from, { type: 'givePenalty', to: d.to, card: from.hand[Math.floor(random() * from.hand.length)] }]);
    }
    out.push([turn.id, { type: 'tick' }]);
  } else if (s.phase === 'phase2') {
    const plays = shuffle(turn.hand.map((card): [string, Action] => [turn.id, { type: 'play', card }]), random);
    const take: [string, Action] = [turn.id, { type: 'take' }];
    out.push(...(random() < 0.9 ? [...plays, take] : [take, ...plays]));
  }
  return out;
}

function playGame(s: GameState, random: () => number): GameState {
  let now = 0;
  for (let step = 0; step < 50_000 && s.phase !== 'over'; step++) {
    now += 1000;
    let moved = false;
    for (const [id, action] of candidates(s, random)) {
      const r = apply(s, id, action, now);
      if (!r.ok) continue;
      s = r.state;
      moved = true;
      break;
    }
    expect(moved, `stuck in ${s.phase}`).toBe(true);
    expectCardsConserved(s);
    for (const p of s.players) expect(viewFor(s, p.id, now).myHand).toEqual(p.hand);
    expectHiddenInfoKept(s, now);
    if (s.phase === 'phase2') expect(s.players.find((p) => p.id === s.turn)!.out).toBe(false);
    // Пустой стол — отбой для всех: в покое при пустом столе пустых рук у активных не остаётся.
    if (s.phase === 'phase2' && s.table.length === 0) {
      expect(s.players.filter((p) => !p.out && p.hand.length === 0).map((p) => p.id)).toEqual([]);
    }
  }
  return s;
}

describe('random games keep invariants', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const players = 2 + (seed % 5);
    const deckSize: DeckSize = seed % 3 === 0 ? 52 : 36;
    it(`seed ${seed}: ${players} players, ${deckSize} cards, 3 games in a session`, () => {
      const random = mulberry32(seed);
      const ids = Array.from({ length: players }, (_, i) => `P${i}`);
      let session: SessionState = newSession();
      for (let game = 0; game < 3; game++) {
        const stallRule: StallRule = seed % 2 === 0 ? 'endGame' : 'forcedVidbiy';
        const s = playGame(createGame(setupNextGame(session, ids, deckSize, seed * 10 + game, stallRule)), random);
        expect(s.phase).toBe('over');
        expect(s.result).not.toBeNull();
        session = recordResult(session, s.result!);
      }
    });
  }
});

function autoPlay(s: GameState, random: () => number): GameState {
  let now = 0;
  for (let step = 0; step < 50_000 && s.phase !== 'over'; step++) {
    now += 1000;
    let moved = false;
    for (const p of s.players) {
      const action = autoAction(s, p.id, random);
      if (!action) continue;
      const r = apply(s, p.id, action, now);
      if (r.ok) {
        s = r.state;
        moved = true;
        break;
      }
    }
    if (!moved) {
      const r = apply(s, s.turn, { type: 'tick' }, now);
      if (r.ok) s = r.state;
    }
    expectCardsConserved(s);
  }
  return s;
}

describe('games where every player times out still end', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const players = 2 + (seed % 5);
    const deckSize: DeckSize = seed % 3 === 0 ? 52 : 36;
    const stallRule: StallRule = seed % 2 === 0 ? 'endGame' : 'forcedVidbiy';
    it(`seed ${seed}: ${players} players, ${stallRule}`, () => {
      const ids = Array.from({ length: players }, (_, i) => `P${i}`);
      const s = autoPlay(createGame(setupNextGame(newSession(), ids, deckSize, seed, stallRule)), mulberry32(seed));
      expect(s.phase).toBe('over');
    });
  }
});

/** Жадный игрок: бьёт самой дешёвой картой (младший ранг, некозырь раньше козыря), иначе берёт; заходит младшим некозырем. */
function greedyStep(s: GameState, random: () => number): [string, Action] {
  if (s.phase !== 'phase2') {
    for (const p of s.players) {
      const action = autoAction(s, p.id, random);
      if (action) return [p.id, action];
    }
    return [s.turn, { type: 'tick' }];
  }
  const cost = (card: Card) => (card.suit === s.trump ? 100 : 0) + card.rank;
  const cheapest = (cards: Card[]) => [...cards].sort((a, b) => cost(a) - cost(b))[0];
  const { playable, canTake } = legalMoves(s, s.turn);
  if (canTake) {
    const card = cheapest(playable);
    return [s.turn, card ? { type: 'play', card } : { type: 'take' }];
  }
  const hand = s.players.find((p) => p.id === s.turn)!.hand;
  const byRank = [...hand].sort((a, b) => a.rank - b.rank);
  return [s.turn, { type: 'play', card: byRank.find((x) => x.suit !== s.trump) ?? byRank[0] }];
}

const GREEDY_SEEDS = 200;

/** Играет партию жадными игроками до конца. */
function greedyGame(seed: number): void {
  const players = 2 + (seed % 5);
  const deckSize: DeckSize = seed % 3 === 0 ? 52 : 36;
  const ids = Array.from({ length: players }, (_, i) => `P${i}`);
  let s = createGame(setupNextGame(newSession(), ids, deckSize, seed, 'forcedVidbiy'));
  const random = mulberry32(seed);
  let now = 0;
  for (let step = 0; step < 50_000 && s.phase !== 'over'; step++) {
    now += 1000;
    const [id, action] = greedyStep(s, random);
    const r = apply(s, id, action, now);
    if (!r.ok) {
      if (action.type === 'tick') continue;
      throw new Error(`${id} ${action.type}: ${r.error}`);
    }
    s = r.state;
  }
  expect(s.phase).toBe('over');
}

// Жадные игроки реально зацикливаются примерно в четверти партий (см. отчёт финальных правок):
// здесь проверяется только, что каждая партия доходит до конца.
describe('greedy players always finish', () => {
  for (let seed = 1; seed <= GREEDY_SEEDS; seed++) {
    it(`greedy seed ${seed}`, () => {
      greedyGame(seed);
    });
  }
});
