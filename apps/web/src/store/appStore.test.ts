import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalMatch, type MatchSetup } from '../client/createLocalMatch';
import { ru } from '../i18n/ru';
import { testHostOptions } from '../test/hostOptions';
import { c, phase1State, phase2State } from '../test/states';
import { fakeClient, makeUpdate, resetStore } from '../test/updates';
import { EXIT_MS } from '../ui/anim/motion';
import { useAppStore } from './appStore';
import { STEP_MS } from './updatePump';

const setup: MatchSetup = { nick: 'Вася', playerCount: 3, settings: { deckSize: 36, turnSeconds: 0, stallRule: 'forcedVidbiy' } };
const start = () =>
  phase1State({ players: [{ id: 'p0', stack: '7H' }, { id: 'p1', stack: 'QC' }, { id: 'p2', stack: 'KD' }], deck: '9S 8C TD JH' });
const makeClient = (s: MatchSetup) => createLocalMatch(s, { ...testHostOptions(3), initialState: start() });

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  resetStore({ makeClient });
});
afterEach(() => {
  useAppStore.getState().goHome();
  vi.useRealTimers();
});

describe('app store', () => {
  it('startMatch preloads the deck first, then opens the table with the first update', async () => {
    let release!: () => void;
    const preload = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    resetStore({ makeClient, preload });
    const started = useAppStore.getState().startMatch(setup);
    expect(useAppStore.getState().screen).toBe('loading');
    expect(preload).toHaveBeenCalledWith(36);
    expect(useAppStore.getState().client).toBeNull();
    release();
    await started;
    const s = useAppStore.getState();
    expect(s.screen).toBe('game');
    expect(s.update!.view.me).toBe('p0');
    expect(s.lastSetup).toEqual(setup);
    expect(s.marks.gameNumber).toBe(1);
  });

  it('applies my intents and receives updates', async () => {
    await useAppStore.getState().startMatch(setup);
    useAppStore.getState().send({ type: 'draw' });
    expect(useAppStore.getState().update!.view.drawn).not.toBeNull();
  });

  it('with animations on, fast updates are queued and shown one step at a time', async () => {
    resetStore({ makeClient, motionEnabled: true });
    await useAppStore.getState().startMatch(setup);
    useAppStore.getState().send({ type: 'draw' });
    const afterDraw = useAppStore.getState().update!;
    expect(afterDraw.view.drawn).not.toBeNull();
    useAppStore.getState().send({ type: 'placeDrawn', to: 'p0' });
    expect(useAppStore.getState().update).toBe(afterDraw);
    vi.advanceTimersByTime(STEP_MS);
    expect(useAppStore.getState().update!.view.drawn).toBeNull();
  });

  it('sends the swept table into a layer of its own and takes that layer down when it has flown', async () => {
    const onTable = phase2State({
      players: [{ id: 'p0', hand: '7H' }, { id: 'p1', hand: 'QC' }, { id: 'p2', hand: 'KD' }],
      table: [['6D', 'p1'], ['7D', 'p2']],
      trump: 'D',
      turn: 'p0',
    });
    // Отбой вырос на те самые две карты: слой полёта верит отбою, а не самому событию.
    const closed = phase2State({
      players: [{ id: 'p0', hand: '7H' }, { id: 'p1', hand: 'QC' }, { id: 'p2', hand: 'KD' }],
      trump: 'D',
      turn: 'p0',
      discard: '6D 7D',
    });
    const { client, emit } = fakeClient(makeUpdate(onTable, 'p0'));
    resetStore({ makeClient: () => client, motionEnabled: true });
    await useAppStore.getState().startMatch(setup);
    expect(useAppStore.getState().sweep).toBeNull();
    emit(makeUpdate(closed, 'p0', { events: [{ type: 'vidbiy', closerId: 'p1' }] }));
    expect(useAppStore.getState().sweep).toMatchObject({ cards: [c('6D'), c('7D')], ms: EXIT_MS });
    // Взятая нижняя не улетает: слой отбоя живёт свой срок и пропадает целиком.
    emit(makeUpdate(start(), 'p0', { events: [{ type: 'tookBottom', playerId: 'p1', card: c('7H') }] }));
    vi.advanceTimersByTime(STEP_MS);
    expect(useAppStore.getState().sweep).not.toBeNull();
    vi.advanceTimersByTime(EXIT_MS);
    expect(useAppStore.getState().sweep).toBeNull();
  });

  it('a new game opens on a clean table: the flying discard layer does not carry over', async () => {
    const onTable = phase2State({
      players: [{ id: 'p0', hand: '7H' }, { id: 'p1', hand: 'QC' }, { id: 'p2', hand: 'KD' }],
      table: [['6D', 'p1'], ['7D', 'p2']],
      trump: 'D',
      turn: 'p0',
    });
    const closed = phase2State({
      players: [{ id: 'p0', hand: '7H' }, { id: 'p1', hand: 'QC' }, { id: 'p2', hand: 'KD' }],
      trump: 'D',
      turn: 'p0',
      discard: '6D 7D',
    });
    const { client, emit } = fakeClient(makeUpdate(onTable, 'p0'));
    resetStore({ makeClient: () => client, motionEnabled: true });
    await useAppStore.getState().startMatch(setup);
    emit(makeUpdate(closed, 'p0', { events: [{ type: 'vidbiy', closerId: 'p1' }] }));
    expect(useAppStore.getState().sweep).not.toBeNull();
    emit(makeUpdate(start(), 'p0', { session: { gameNumber: 2, losses: {}, vakhterId: null, status: 'playing', canContinue: true } }));
    vi.advanceTimersByTime(STEP_MS);
    expect(useAppStore.getState().update!.session.gameNumber).toBe(2);
    expect(useAppStore.getState().sweep).toBeNull();
    expect(useAppStore.getState().celebrating).toBe(false);
  });

  it('shows a Russian toast and vibrates for a rejected intent, and drops the selection', async () => {
    const buzz = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: buzz, configurable: true });
    await useAppStore.getState().startMatch(setup);
    useAppStore.getState().select({ kind: 'ownTop' });
    useAppStore.getState().send({ type: 'take' });
    const s = useAppStore.getState();
    expect(s.toasts.at(-1)).toMatchObject({ text: ru.errors.wrong_phase, tone: 'error' });
    expect(s.selection).toBeNull();
    expect(buzz).toHaveBeenCalledWith(80);
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('play-as, bot speed and autopilot go to the client', async () => {
    await useAppStore.getState().startMatch(setup);
    useAppStore.getState().playAs('p2');
    expect(useAppStore.getState().update!.view.me).toBe('p2');
    useAppStore.getState().playAs('p0');
    useAppStore.getState().setBotSpeed(3);
    useAppStore.getState().setAutopilot(true);
    useAppStore.getState().toggleDebug();
    expect(useAppStore.getState().debug).toMatchObject({ botSpeed: 3, autopilot: true, open: true });
    vi.advanceTimersByTime(1000);
    expect(useAppStore.getState().log.some((e) => e.playerId === 'p0' && e.action?.type === 'draw')).toBe(true);
  });

  it('reads the log from the client only while the debug panel is open, not on every queued update', async () => {
    await useAppStore.getState().startMatch(setup);
    const client = useAppStore.getState().client!;
    const logSpy = vi.spyOn(client.debug!, 'log');
    logSpy.mockClear();
    useAppStore.getState().send({ type: 'draw' });
    expect(logSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().log).toEqual([]);
    useAppStore.getState().toggleDebug();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().log.length).toBeGreaterThan(0);
    logSpy.mockClear();
    useAppStore.getState().playAs('p0');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('a client without the debug seam (a future network one) drives the table just the same', async () => {
    const { client, emit } = fakeClient(makeUpdate(start(), 'p0'), { withDebug: false });
    resetStore({ makeClient: () => client });
    await useAppStore.getState().startMatch(setup);
    expect(useAppStore.getState().screen).toBe('game');
    expect(useAppStore.getState().allHands).toBeNull();
    expect(useAppStore.getState().log).toEqual([]);
    const store = useAppStore.getState();
    store.setShowAllHands(true);
    store.setBotSpeed(3);
    store.setAutopilot(true);
    store.toggleDebug();
    store.playAs('p2');
    emit(makeUpdate(start(), 'p0'));
    expect(useAppStore.getState().screen).toBe('game');
    expect(useAppStore.getState().allHands).toBeNull();
    expect(useAppStore.getState().log).toEqual([]);
    expect(useAppStore.getState().debug).toMatchObject({ botSpeed: 3, autopilot: true, open: true, showAllHands: true });
  });

  it('show all hands pulls hands from the client', async () => {
    await useAppStore.getState().startMatch(setup);
    useAppStore.getState().setShowAllHands(true);
    expect(Object.keys(useAppStore.getState().allHands!)).toEqual(['p0', 'p1', 'p2']);
    useAppStore.getState().setShowAllHands(false);
    expect(useAppStore.getState().allHands).toBeNull();
  });

  it('toasts stack up to four and can be dismissed', () => {
    const { pushToast } = useAppStore.getState();
    for (let i = 0; i < 6; i++) pushToast(`t${i}`);
    const toasts = useAppStore.getState().toasts;
    expect(toasts.map((t) => t.text)).toEqual(['t2', 't3', 't4', 't5']);
    useAppStore.getState().dismissToast(toasts[0].id);
    expect(useAppStore.getState().toasts).toHaveLength(3);
  });

  it('goHome disposes the match; restart deals again with the same setup', async () => {
    await useAppStore.getState().startMatch(setup);
    useAppStore.getState().goHome();
    expect(useAppStore.getState()).toMatchObject({ screen: 'home', client: null, update: null });
    vi.advanceTimersByTime(60_000);
    expect(useAppStore.getState().update).toBeNull();
    await useAppStore.getState().startMatch(setup);
    const first = useAppStore.getState().client;
    await useAppStore.getState().restart();
    expect(useAppStore.getState().client).not.toBe(first);
    expect(useAppStore.getState().screen).toBe('game');
  });

  it('going home while the deck is still loading cancels the start', async () => {
    let release!: () => void;
    resetStore({ makeClient, preload: () => new Promise<void>((resolve) => (release = resolve)) });
    const started = useAppStore.getState().startMatch(setup);
    useAppStore.getState().goHome();
    release();
    await started;
    expect(useAppStore.getState()).toMatchObject({ screen: 'home', client: null });
  });
});
