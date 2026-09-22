import { parseCard, type ErrorCode } from '@vakhta/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalHost } from '../host/LocalHost';
import { ru } from '../i18n/ru';
import { testHostOptions } from '../test/hostOptions';
import { phase1State } from '../test/states';
import { createLocalMatch, type MatchSetup } from './createLocalMatch';
import { LocalGameClient } from './LocalGameClient';
import { makeSeats } from './seats';
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

  it('unsubscribing a listener stops its updates while others keep receiving them', () => {
    const client = createLocalMatch(setup, { ...testHostOptions(1), initialState: myTurn() });
    const a: ClientUpdate[] = [];
    const b: ClientUpdate[] = [];
    const offA = client.subscribe((u) => a.push(u));
    client.subscribe((u) => b.push(u));
    client.send({ type: 'draw' });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    offA();
    client.debug.playAs('p1');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
    client.dispose();
  });

  it('unsubscribing an error listener stops its notifications while others keep receiving them', () => {
    const client = createLocalMatch(setup, { ...testHostOptions(1), initialState: myTurn() });
    const a: ErrorCode[] = [];
    const b: ErrorCode[] = [];
    const offA = client.onError((code) => a.push(code));
    client.onError((code) => b.push(code));
    client.send({ type: 'take' });
    expect(a).toEqual(['wrong_phase']);
    expect(b).toEqual(['wrong_phase']);
    offA();
    client.send({ type: 'take' });
    expect(a).toEqual(['wrong_phase']);
    expect(b).toEqual(['wrong_phase', 'wrong_phase']);
    client.dispose();
  });

  it('dispose stops all delivery and detaches the client from the host', () => {
    const seats = makeSeats(setup.nick, setup.playerCount);
    const host = new LocalHost({ ...testHostOptions(1), seats, settings: setup.settings, initialState: myTurn() });
    host.start();
    const client = new LocalGameClient(host, seats[0].id);
    const updates: ClientUpdate[] = [];
    const errors: ErrorCode[] = [];
    client.subscribe((u) => updates.push(u));
    client.onError((code) => errors.push(code));
    client.dispose();
    host.act('p0', { type: 'draw' });
    host.act('p0', { type: 'take' });
    expect(updates).toEqual([]);
    expect(errors).toEqual([]);
  });
});
