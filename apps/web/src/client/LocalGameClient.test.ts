import { parseCard, type ErrorCode } from '@vakhta/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../i18n/ru';
import { testHostOptions } from '../test/hostOptions';
import { phase1State } from '../test/states';
import { createLocalMatch, type MatchSetup } from './createLocalMatch';
import type { ClientUpdate } from './types';

const setup: MatchSetup = { nick: 'Вася', playerCount: 3, settings: { deckSize: 36, turnSeconds: 0, stallRule: 'forcedVidbiy' } };
const myTurn = () =>
  phase1State({ players: [{ id: 'p0', stack: '7H' }, { id: 'p1', stack: 'QC' }, { id: 'p2', stack: 'KD' }], deck: '9S 8C TD JH' });

beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => vi.useRealTimers());

describe('LocalGameClient', () => {
  it('shows the human seat with names from the set', () => {
    const client = createLocalMatch(setup, testHostOptions(1));
    const update = client.snapshot()!;
    expect(client.me()).toBe('p0');
    expect(update.view.me).toBe('p0');
    expect(update.players.map((p) => p.name)).toEqual(['Вася', ru.botNames[0], ru.botNames[1]]);
    expect(update.players.map((p) => p.isBot)).toEqual([false, true, true]);
    expect(update.session).toMatchObject({ gameNumber: 1, status: 'playing' });
    client.dispose();
  });

  it('reports rejected intents through onError and keeps the state', () => {
    const client = createLocalMatch(setup, { ...testHostOptions(1), initialState: myTurn() });
    const errors: ErrorCode[] = [];
    const updates: ClientUpdate[] = [];
    client.onError((code) => errors.push(code));
    client.subscribe((u) => updates.push(u));
    client.send({ type: 'take' });
    expect(errors).toEqual(['wrong_phase']);
    expect(updates).toEqual([]);
  });

  it('delivers events once and play-as switches the seat', () => {
    const client = createLocalMatch(setup, { ...testHostOptions(1), initialState: myTurn() });
    const updates: ClientUpdate[] = [];
    client.subscribe((u) => updates.push(u));
    client.send({ type: 'draw' });
    expect(updates.at(-1)!.events).toContainEqual({ type: 'drew', playerId: 'p0', card: parseCard('9S') });
    client.debug.playAs('p1');
    const last = updates.at(-1)!;
    expect(last.events).toEqual([]);
    expect(last.view.me).toBe('p1');
    expect(client.me()).toBe('p1');
    expect(last.players.find((p) => p.id === 'p0')!.isBot).toBe(true);
    expect(last.players.find((p) => p.id === 'p1')!.isBot).toBe(false);
  });

  it('exposes all hands and the log for debugging', () => {
    const client = createLocalMatch(setup, testHostOptions(2));
    expect(Object.keys(client.debug.allHands())).toEqual(['p0', 'p1', 'p2']);
    expect(client.debug.log()[0].note).toBe('game 1');
  });
});
