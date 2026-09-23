import { apply, mulberry32, type GameState } from '@vakhta/engine';
import { describe, expect, it } from 'vitest';
import { c, penaltyState, phase1State, phase2State } from '../../testing/states';
import { BOT_REACTION_MAX_MS, BOT_REACTION_MIN_MS, botAction, botVakhtaDelay, cheapest } from '../../src/bots/botAction';

const always = (value: number) => () => value;
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

// A обязан переложить 9H на 8D у B.
const mustMove = () =>
  phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }, { id: 'C', stack: 'KD' }], deck: 'QS JD 7C' });
// У A вытянута TS, цель «+1» — 9C у B.
const keepable = () =>
  phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }, { id: 'C', stack: 'KD' }], deck: 'QH JD 8C', drawn: 'TS' });

const lastWatchViolated = (s: GameState, action: Parameters<typeof apply>[2]) => {
  const r = apply(s, 'A', action, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state.watches[r.state.watches.length - 1]?.violated;
};

describe('bots, phase 1', () => {
  it('plays by the rules when the roll is 15% or more', () => {
    expect(botAction(mustMove(), 'A', always(0.5))).toEqual({ type: 'moveOwnTop', to: 'B' });
    expect(botAction(keepable(), 'A', always(0.15))).toEqual({ type: 'placeDrawn', to: 'B' });
  });

  it('mistake (a): draws although the own top card had to move — a real violation', () => {
    const s = mustMove();
    const action = botAction(s, 'A', always(0.1));
    expect(action).toEqual({ type: 'draw' });
    expect(lastWatchViolated(s, action!)).toBe(true);
  });

  it('mistake (b): keeps a card that had a +1 target at an opponent — a real violation', () => {
    const s = keepable();
    const action = botAction(s, 'A', always(0.1));
    expect(action).toEqual({ type: 'placeDrawn', to: 'A' });
    expect(lastWatchViolated(s, action!)).toBe(true);
  });

  it('makes no "mistake" when +1 onto its own stack would be legal anyway', () => {
    const s = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '7S' }], deck: 'QH JD', drawn: '8C' });
    expect(botAction(s, 'A', always(0.1))).toEqual({ type: 'placeDrawn', to: 'B' });
  });

  it('makes no mistake when none is possible', () => {
    const s = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }], deck: 'KD 8C 9S' });
    expect(botAction(s, 'A', always(0))).toEqual({ type: 'draw' });
  });

  it('errs in about 15% of possible cases', () => {
    const rng = mulberry32(7);
    let mistakes = 0;
    for (let i = 0; i < 4000; i++) {
      const a = botAction(keepable(), 'A', rng);
      if (a?.type === 'placeDrawn' && a.to === 'A') mistakes++;
    }
    expect(mistakes / 4000).toBeGreaterThan(0.12);
    expect(mistakes / 4000).toBeLessThan(0.18);
  });
});

describe('bots, vakhta', () => {
  const withWatch = (violated: boolean, called = false): GameState => ({
    ...keepable(),
    watches: [{ id: 1, playerId: 'A', at: 0, violated, called, othersActed: false }],
  });

  it('spots a real violation with 50% and reacts in 0.8–2.5 s', () => {
    expect(botVakhtaDelay(withWatch(true), 'B', 1, seq(0.49, 0))).toBe(BOT_REACTION_MIN_MS);
    expect(botVakhtaDelay(withWatch(true), 'B', 1, seq(0.49, 1))).toBe(BOT_REACTION_MAX_MS);
    expect(botVakhtaDelay(withWatch(true), 'B', 1, always(0.5))).toBeNull();
  });

  it('calls falsely with 3%', () => {
    expect(botVakhtaDelay(withWatch(false), 'B', 1, always(0.029))).not.toBeNull();
    expect(botVakhtaDelay(withWatch(false), 'B', 1, always(0.03))).toBeNull();
  });

  it('never calls on its own window, a called window or a missing one', () => {
    expect(botVakhtaDelay(withWatch(true), 'A', 1, always(0))).toBeNull();
    expect(botVakhtaDelay(withWatch(true, true), 'B', 1, always(0))).toBeNull();
    expect(botVakhtaDelay(withWatch(true), 'B', 2, always(0))).toBeNull();
  });

  it('frequencies match the spec over many windows', () => {
    const rng = mulberry32(11);
    const rate = (violated: boolean) => {
      let calls = 0;
      for (let i = 0; i < 4000; i++) if (botVakhtaDelay(withWatch(violated), 'B', 1, rng) !== null) calls++;
      return calls / 4000;
    };
    expect(rate(true)).toBeGreaterThan(0.46);
    expect(rate(true)).toBeLessThan(0.54);
    expect(rate(false)).toBeGreaterThan(0.02);
    expect(rate(false)).toBeLessThan(0.04);
  });
});

describe('bots, penalty and phase 2', () => {
  it('cheapest: non-trump before trump, then the lower rank', () => {
    expect(cheapest([c('6D'), c('AS'), c('9C')], 'D')).toEqual(c('9C'));
    expect(cheapest([c('8D'), c('7D')], 'D')).toEqual(c('7D'));
    expect(cheapest([], 'D')).toBeNull();
  });

  it('penalty: gives its weakest card, non-trump first', () => {
    const s = penaltyState({
      players: [{ id: 'A', hand: 'QH 6D 7C' }, { id: 'B', hand: 'AS' }],
      trump: 'D',
      debts: [{ from: 'A', to: 'B', count: 1 }],
    });
    expect(botAction(s, 'A', always(0.5))).toEqual({ type: 'givePenalty', to: 'B', card: c('7C') });
    expect(botAction(s, 'B', always(0.5))).toBeNull();
  });

  it('beats with the cheapest fitting card: same suit before trump', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'QH JH 7D 6C' }, { id: 'B', hand: 'AS' }], trump: 'D', turn: 'A', table: [['9H', 'B']] });
    expect(botAction(s, 'A', always(0.5))).toEqual({ type: 'play', card: c('JH') });
  });

  it('uses the lowest trump when it has no same-suit card', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '8D 7D 6C' }, { id: 'B', hand: 'AS' }], trump: 'D', turn: 'A', table: [['9H', 'B']] });
    expect(botAction(s, 'A', always(0.5))).toEqual({ type: 'play', card: c('7D') });
  });

  it('takes the bottom when it cannot beat', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '6C 7C' }, { id: 'B', hand: 'AS' }], trump: 'D', turn: 'A', table: [['9H', 'B']] });
    expect(botAction(s, 'A', always(0.5))).toEqual({ type: 'take' });
  });

  it('leads its lowest non-trump on an empty table', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'AS 7D 8C' }, { id: 'B', hand: 'AH' }], trump: 'D', turn: 'A' });
    expect(botAction(s, 'A', always(0.5))).toEqual({ type: 'play', card: c('8C') });
  });

  it('does nothing when it is not its turn', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'AS' }, { id: 'B', hand: 'AH' }], trump: 'D', turn: 'A' });
    expect(botAction(s, 'B', always(0.5))).toBeNull();
  });
});
