import { VAKHTA_GRACE_MS, makeDeck, mulberry32, shuffle, type DeckSize, type GameState } from '@vakhta/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_REACTION_MAX_MS } from '../bots/botAction';
import { runUntil, testHostOptions } from '../test/hostOptions';
import { penaltyState, phase1State } from '../test/states';
import type { MatchSettings, SeatInfo } from '../client/types';
import { LocalHost, type HostOptions } from './LocalHost';
import { BOT_DELAY_MAX_MS, PENALTY_MS, TICK_SLACK_MS } from './types';

/** Заглушка движка: по флагу отклоняет любое действие — так воспроизводится отказ и боту, и запасному автоходу. */
const engine = vi.hoisted(() => ({ rejectAll: false }));
vi.mock('@vakhta/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vakhta/engine')>();
  return {
    ...actual,
    apply: (...args: Parameters<typeof actual.apply>) =>
      engine.rejectAll ? { ok: false as const, error: 'illegal_move' as const } : actual.apply(...args),
  };
});

const human = (id: string): SeatInfo => ({ id, name: id, avatar: 'x', isBot: false });
const bot = (id: string): SeatInfo => ({ id, name: id, avatar: 'x', isBot: true });
const bots = (n: number) => Array.from({ length: n }, (_, i) => bot(`b${i}`));
const settings = (deckSize: DeckSize = 36, turnSeconds: MatchSettings['turnSeconds'] = 0): MatchSettings => ({
  deckSize, turnSeconds, stallRule: 'forcedVidbiy',
});

function makeHost(o: Partial<HostOptions> & { seats: SeatInfo[]; seed?: number }): LocalHost {
  return new LocalHost({ settings: settings(), ...testHostOptions(o.seed ?? 1), ...o });
}

const playerOf = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

const always = (value: number) => () => value;
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => {
  engine.rejectAll = false;
  vi.useRealTimers();
});

describe('LocalHost, all-bot sessions', () => {
  it.each([
    [1, 3, 36],
    [2, 4, 36],
    [3, 6, 52],
    [4, 2, 36],
    [5, 5, 36],
  ] as const)('seed %i: %i bots, deck %i — a 3-game session always finishes', (seed, count, deckSize) => {
    const host = makeHost({ seats: bots(count), settings: settings(deckSize), seed });
    host.start();
    for (let game = 1; game <= 3; game++) {
      runUntil(() => host.getStatus() !== 'playing');
      expect(host.getStatus()).toBe('gameOver');
      expect(host.getState()!.phase).toBe('over');
      expect(host.getSummary().gameNumber).toBe(game);
      if (game < 3) expect(host.nextGame()).toBe(true);
    }
    host.endSession();
    const summary = host.getSummary();
    expect(summary.status).toBe('sessionOver');
    expect(Object.values(summary.losses).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3);
    // Счётчик, а не скан журнала: журнал усекается до LOG_LIMIT записей, а сессия может произвести больше.
    expect(host.getErrorCount()).toBe(0);
    host.dispose();
  });

  it('bots play only after their delay', () => {
    const host = makeHost({ seats: bots(3) });
    host.start();
    const before = host.getChangeSeq();
    vi.advanceTimersByTime(500);
    expect(host.getChangeSeq()).toBe(before);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(host.getChangeSeq()).toBeGreaterThan(before);
  });

  it('bot speed 3× divides the delay', () => {
    const host = makeHost({ seats: bots(3), botSpeed: 3 });
    host.start();
    const before = host.getChangeSeq();
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS / 3 + 1);
    expect(host.getChangeSeq()).toBeGreaterThan(before);
  });
});

describe('LocalHost, timers', () => {
  it('turn timer auto-plays the human turn in phase 1', () => {
    const host = makeHost({ seats: [human('me'), bot('b1'), bot('b2')], settings: settings(36, 15), seed: 5 });
    host.start();
    runUntil(() => host.getState()!.phase === 'phase1' && host.getState()!.turn === 'me');
    const endsAt = host.getDeadlines().turnEndsAt!;
    expect(host.getDeadlines().turnTotalMs).toBe(15_000);
    expect(endsAt).toBeGreaterThan(Date.now());
    vi.advanceTimersByTime(endsAt - Date.now() - 1);
    expect(host.getState()!.turn).toBe('me');
    vi.advanceTimersByTime(1);
    const s = host.getState()!;
    expect(s.phase !== 'phase1' || s.turn !== 'me').toBe(true);
    expect(host.getLog().some((e) => e.playerId === 'me' && e.action?.type === 'draw')).toBe(true);
  });

  it('turn timer is off when turnSeconds is 0', () => {
    const state = phase1State({ players: [{ id: 'me', stack: '7H' }, { id: 'b1', stack: 'QC' }], deck: 'KD 8C 9S' });
    const host = makeHost({ seats: [human('me'), bot('b1')], initialState: state });
    host.start();
    expect(host.getDeadlines()).toMatchObject({ turnEndsAt: null, turnTotalMs: null });
    vi.advanceTimersByTime(120_000);
    expect(host.getState()!.turn).toBe('me');
  });

  it('penalty timer gives cards for the human after 20 s', () => {
    const state = penaltyState({
      players: [{ id: 'me', hand: '6C 7C 8C' }, { id: 'b1', hand: '9D TD', fouls: 2 }, { id: 'b2', hand: 'JD QD' }],
      trump: 'D',
      debts: [{ from: 'me', to: 'b1', count: 2 }],
      lastCardDrawerId: 'b1',
    });
    const host = makeHost({ seats: [human('me'), bot('b1'), bot('b2')], initialState: state });
    host.start();
    expect(host.getDeadlines()).toMatchObject({ penaltyEndsAt: PENALTY_MS, penaltyTotalMs: PENALTY_MS });
    vi.advanceTimersByTime(PENALTY_MS - 1);
    expect(host.getState()!.phase).toBe('penalty');
    vi.advanceTimersByTime(1);
    const s = host.getState()!;
    expect(s.phase).toBe('phase2');
    expect(playerOf(s, 'me').hand).toHaveLength(1);
    expect(playerOf(s, 'b1').hand).toHaveLength(4);
    expect(host.getDeadlines().penaltyEndsAt).toBeNull();
  });

  it('sends tick at nextDeadline, which starts phase 2', () => {
    const state = penaltyState({
      players: [{ id: 'b1', hand: '6C 7C' }, { id: 'b2', hand: 'JD QD' }],
      trump: 'H',
      lastCardDrawerId: 'b1',
      watches: [{ id: 1, playerId: 'b1', at: 0, violated: false, called: false, othersActed: true }],
    });
    const host = makeHost({ seats: [bot('b1'), bot('b2')], initialState: state, random: () => 0.99 });
    host.start();
    vi.advanceTimersByTime(VAKHTA_GRACE_MS - 1);
    expect(host.getState()!.phase).toBe('penalty');
    vi.advanceTimersByTime(TICK_SLACK_MS + 1);
    expect(host.getState()!.phase).toBe('phase2');
    expect(host.getLog().some((e) => e.action?.type === 'tick')).toBe(true);
  });
});

describe('LocalHost, vakhta, play-as, autopilot, crash', () => {
  it('a bot calls Vakhta on the human violation and the human gets a foul', () => {
    // У me вытянута TS с целью «+1» на 9C у b1; me оставляет её себе.
    const state = phase1State({
      players: [{ id: 'me', stack: '7H' }, { id: 'b1', stack: '9C' }, { id: 'b2', stack: 'KD' }],
      deck: 'QH JD 8C 6S',
      drawn: 'TS',
    });
    const host = makeHost({ seats: [human('me'), bot('b1'), bot('b2')], initialState: state, random: () => 0.1 });
    host.start();
    expect(host.act('me', { type: 'placeDrawn', to: 'me' })).toEqual({ ok: true });
    vi.advanceTimersByTime(BOT_REACTION_MAX_MS);
    expect(playerOf(host.getState()!, 'me').fouls).toBe(1);
    expect(host.getLog().some((e) => e.events.some((ev) => ev.type === 'vakhta' && ev.fouled.includes('me')))).toBe(true);
  });

  it('a seat taken over by the human before its scheduled Vakhta call never calls', () => {
    // b0 оставляет себе TS с целью «+1» на 9C у b1 — нарушение, за него решит вызвать b1.
    const state = phase1State({
      players: [{ id: 'b0', stack: '7H' }, { id: 'b1', stack: '9C' }],
      deck: 'QH JD 8C',
      drawn: 'TS',
      turn: 'b0',
    });
    const host = makeHost({ seats: [bot('b0'), bot('b1')], initialState: state, random: always(0.1) });
    host.start();
    expect(host.act('b0', { type: 'placeDrawn', to: 'b0' })).toEqual({ ok: true });
    // В этот момент бот b1 уже запланировал вызов Вахты (~970 мс). Человек забирает место b1 раньше.
    host.setHumanSeat('b1');
    vi.advanceTimersByTime(BOT_REACTION_MAX_MS + 50);
    expect(host.getLog().some((e) => e.playerId === 'b1' && e.action?.type === 'callVakhta')).toBe(false);
  });

  it('turning autopilot off before a scheduled Vakhta call restores the seat to the human', () => {
    // b1 оставляет себе TS с целью «+1» на 9C у me — нарушение; под автопилотом бот решит вызвать за me.
    const state = phase1State({
      players: [{ id: 'b1', stack: '7H' }, { id: 'me', stack: '9C' }],
      deck: 'QH JD 8C',
      drawn: 'TS',
      turn: 'b1',
    });
    const host = makeHost({ seats: [human('me'), bot('b1')], initialState: state, random: always(0.1) });
    host.start();
    host.setAutopilot(true);
    expect(host.act('b1', { type: 'placeDrawn', to: 'b1' })).toEqual({ ok: true });
    // me под автопилотом уже запланировал вызов Вахты (~970 мс). Автопилот выключают раньше.
    host.setAutopilot(false);
    vi.advanceTimersByTime(BOT_REACTION_MAX_MS + 50);
    expect(host.getLog().some((e) => e.playerId === 'me' && e.action?.type === 'callVakhta')).toBe(false);
  });

  it('does not call once the decided watch window has already closed', () => {
    // Долгов нет — как только окно закроется, штраф сразу перейдёт в фазу 2.
    const state = {
      ...penaltyState({
        players: [{ id: 'b1', hand: '6C 7C' }, { id: 'b2', hand: 'JD QD' }],
        trump: 'H',
        lastCardDrawerId: 'b1',
      }),
      watches: [{ id: 1, playerId: 'b1', at: -2500, violated: true, called: false, othersActed: true }],
    };
    // Решение принимается сразу (0.4 < BOT_SPOT_CHANCE) с максимальной задержкой (BOT_REACTION_MAX_MS).
    const host = makeHost({ seats: [bot('b1'), bot('b2')], initialState: state, random: seq(0.4, 1) });
    host.start();
    // Тик закрывает окно (grace 3000 мс от at=-2500, т.е. к 500 мс) задолго до срабатывания решения (2500 мс).
    vi.advanceTimersByTime(BOT_REACTION_MAX_MS + TICK_SLACK_MS + 50);
    expect(host.getLog().some((e) => e.playerId === 'b2' && e.action?.type === 'callVakhta')).toBe(false);
  });

  it('rejects illegal intents without changing the state', () => {
    const state = phase1State({ players: [{ id: 'me', stack: '7H' }, { id: 'b1', stack: 'QC' }], deck: 'KD 8C 9S' });
    const host = makeHost({ seats: [human('me'), bot('b1')], initialState: state });
    host.start();
    const seq = host.getChangeSeq();
    expect(host.act('b1', { type: 'draw' })).toEqual({ ok: false, error: 'not_your_turn' });
    expect(host.act('me', { type: 'take' })).toEqual({ ok: false, error: 'wrong_phase' });
    expect(host.getChangeSeq()).toBe(seq);
  });

  it('setHumanSeat hands the seat to the human and the old seat to the bots', () => {
    const state = phase1State({ players: [{ id: 'me', stack: '7H' }, { id: 'b1', stack: 'QC' }, { id: 'b2', stack: 'KD' }], deck: 'AS 8C 9S JD' });
    const host = makeHost({ seats: [human('me'), bot('b1'), bot('b2')], initialState: state });
    const seen: number[] = [];
    host.subscribe(() => seen.push(host.getChangeSeq()));
    host.start();
    host.setHumanSeat('b1');
    expect(seen.length).toBe(2);
    expect(host.isBotControlled('me')).toBe(true);
    expect(host.isBotControlled('b1')).toBe(false);
    expect(host.getSeats().map((s) => s.isBot)).toEqual([true, false, true]);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(host.getLog().some((e) => e.playerId === 'me' && e.action?.type === 'draw')).toBe(true);
  });

  it('autopilot lets a bot play for the human', () => {
    const state = phase1State({ players: [{ id: 'me', stack: '7H' }, { id: 'b1', stack: 'QC' }], deck: 'AS 8C 9S JD' });
    const host = makeHost({ seats: [human('me'), bot('b1')], initialState: state });
    host.start();
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(host.getLog().some((e) => e.playerId === 'me')).toBe(false);
    host.setAutopilot(true);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(host.getLog().some((e) => e.playerId === 'me' && e.action?.type === 'draw')).toBe(true);
  });

  it('engine exceptions put the host into the crashed state with the stack in the log', () => {
    let calls = 0;
    const host = makeHost({
      seats: bots(3),
      shuffleDeck: (size) => (calls++ === 0 ? shuffle(makeDeck(size), mulberry32(9)) : []),
    });
    host.start();
    runUntil(() => host.getStatus() !== 'playing');
    expect(host.nextGame()).toBe(false);
    expect(host.getStatus()).toBe('crashed');
    expect(host.getLog().at(-1)!.error).toContain('bad_deck');
    expect(host.getState()).not.toBeNull();
  });

  it('viewFor never shows other hands', () => {
    const host = makeHost({ seats: [human('me'), bot('b1'), bot('b2')] });
    host.start();
    const view = host.viewFor('me')!;
    expect(view.me).toBe('me');
    expect(Object.keys(host.getHands())).toEqual(['me', 'b1', 'b2']);
    expect(JSON.stringify(view)).not.toContain('prykup":[');
  });
});

describe('LocalHost, a rejected bot action never freezes the match', () => {
  const twoBots = () => phase1State({ players: [{ id: 'b1', stack: '7H' }, { id: 'b2', stack: 'QC' }], deck: 'KD 8C 9S AS TH JD' });

  it('keeps retrying instead of hanging, and carries on once the engine takes actions again', () => {
    const host = makeHost({ seats: [bot('b1'), bot('b2')], initialState: twoBots() });
    host.start();
    engine.rejectAll = true;
    const seq = host.getChangeSeq();
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    const afterFirst = host.getErrorCount();
    expect(afterFirst).toBeGreaterThanOrEqual(2);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    // Шаг перепланирован: отказ не оставил партию без единого висящего таймера.
    expect(host.getErrorCount()).toBeGreaterThan(afterFirst);
    expect(host.getChangeSeq()).toBe(seq);
    expect(host.getStatus()).toBe('playing');
    engine.rejectAll = false;
    runUntil(() => host.getStatus() !== 'playing');
    expect(host.getStatus()).toBe('gameOver');
    host.dispose();
  });

  it('surfaces the crash state when the steps keep failing, instead of a silent freeze', () => {
    const host = makeHost({ seats: [bot('b1'), bot('b2')], initialState: twoBots() });
    host.start();
    engine.rejectAll = true;
    runUntil(() => host.getStatus() !== 'playing', 120_000);
    expect(host.getStatus()).toBe('crashed');
    expect(host.getLog().at(-1)!.error).toContain('b1');
    host.dispose();
  });
});
