import { describe, expect, it } from 'vitest';
import type { GameResult } from '@vakhta/engine';
import type { ClientUpdate } from '../client/types';
import { ru } from '../i18n/ru';
import { c, phase1State, phase2State } from '../test/states';
import { makeUpdate, seatsFor } from '../test/updates';
import { FX_MS, actingFrom, celebrationHoldMs, emptyMarks, errorText, eventToasts, isFresh, keepSelection, nextMarks, sweptCards } from './derive';

const p2 = phase2State({ players: [{ id: 'A', hand: '6C' }, { id: 'B', hand: '7C' }, { id: 'C', hand: '8C' }], trump: 'D', turn: 'A' });

describe('store derive', () => {
  it('turns vakhta events into toasts with names', () => {
    const update = makeUpdate(p2, 'A', {
      players: seatsFor(p2, { B: 'Боря' }),
      events: [{ type: 'vakhta', callerId: 'A', fouled: ['B'] }],
    });
    expect(eventToasts(update)).toEqual([{ text: 'Вахта! Боря получил фол', tone: 'vakhta' }]);
    const falseCall = makeUpdate(p2, 'A', { events: [{ type: 'vakhta', callerId: 'A', fouled: [] }] });
    expect(eventToasts(falseCall)).toEqual([{ text: ru.toast.falseAlarm, tone: 'info' }]);
  });

  it('announces a stalled battle', () => {
    const update = makeUpdate(p2, 'A', { events: [{ type: 'stall', rule: 'endGame' }] });
    expect(eventToasts(update)).toEqual([{ text: ru.toast.stall.endGame, tone: 'info' }]);
  });

  it('remembers who took, who beat and opened prykups', () => {
    let marks = nextMarks(emptyMarks(1), makeUpdate(p2, 'A', {
      events: [
        { type: 'played', playerId: 'A', card: c('6C') },
        { type: 'tookBottom', playerId: 'B', card: c('6C') },
      ],
    }));
    expect(marks.acts).toEqual({ A: 'beat', B: 'took' });
    marks = nextMarks(marks, makeUpdate(p2, 'A', { events: [{ type: 'vidbiy', closerId: 'C' }, { type: 'prykupOpened', playerId: 'C' }] }));
    expect(marks.acts).toEqual({});
    expect(marks.opened).toEqual(['C']);
    const kept = nextMarks(marks, makeUpdate(p2, 'A'));
    expect(kept).toBe(marks);
    const next = nextMarks(marks, makeUpdate(p2, 'A', { session: { ...makeUpdate(p2, 'A').session, gameNumber: 2 } }));
    expect(next).toEqual(emptyMarks(2));
  });

  it('marks the Vakhta caller only for the batch with the call', () => {
    const marks = nextMarks(emptyMarks(1), makeUpdate(p2, 'A', { events: [{ type: 'vakhta', callerId: 'B', fouled: [] }] }));
    expect(marks).toMatchObject({ vakhtaBy: 'B', vakhtaCaught: false, caught: null });
    expect(nextMarks(marks, makeUpdate(p2, 'A', { events: [{ type: 'phase', phase: 'phase2' }] })).vakhtaBy).toBeNull();
  });

  it('keeps the "caught on Vakhta" and "went out" effects keyed by a sequence number and a time', () => {
    let marks = nextMarks(emptyMarks(1), makeUpdate(p2, 'A', { events: [{ type: 'vakhta', callerId: 'B', fouled: ['C'] }] }), 1000);
    expect(marks).toMatchObject({ vakhtaCaught: true, caught: { seq: 1, at: 1000, offenders: ['C'], callerId: 'B' } });
    marks = nextMarks(marks, makeUpdate(p2, 'A', { events: [{ type: 'out', playerId: 'A' }] }), 1500);
    expect(marks.caught).toEqual({ seq: 1, at: 1000, offenders: ['C'], callerId: 'B' });
    expect(marks.vakhtaCaught).toBe(false);
    expect(marks.outFx).toEqual({ A: { seq: 2, at: 1500 } });
    expect(marks.seq).toBe(2);
    expect(isFresh(marks.caught, 1000 + FX_MS - 1)).toBe(true);
    expect(isFresh(marks.caught, 1000 + FX_MS)).toBe(false);
    expect(isFresh(null, 0)).toBe(false);
  });

  it('collects the cards a vidbiy sent to the discard: the table of the last slice plus what closed it', () => {
    const onTable = phase2State({
      players: [{ id: 'A', hand: '6C' }, { id: 'B', hand: '7C' }, { id: 'C', hand: '8C' }],
      table: [['6D', 'B'], ['7D', 'C']],
      trump: 'D',
      turn: 'A',
    });
    const prev = makeUpdate(onTable, 'A');
    const closed = phase2State({
      players: [{ id: 'A', hand: '6C' }, { id: 'B', hand: '7C' }, { id: 'C', hand: '8C' }],
      trump: 'D',
      turn: 'A',
      discard: '6D 7D 8D',
    });
    const vidbiy = makeUpdate(closed, 'A', {
      events: [{ type: 'played', playerId: 'A', card: c('8D') }, { type: 'vidbiy', closerId: 'A' }],
    });
    expect(sweptCards(prev, vidbiy)).toEqual([c('6D'), c('7D'), c('8D')]);
    // Взятая нижняя не улетает — она переезжает в руку одним элементом; и без отбоя улетать нечему.
    const took = makeUpdate(p2, 'A', { events: [{ type: 'tookBottom', playerId: 'B', card: c('6D') }] });
    expect(sweptCards(prev, took)).toEqual([]);
    expect(sweptCards(prev, makeUpdate(p2, 'A'))).toEqual([]);
    expect(sweptCards(null, vidbiy)).toEqual([c('8D')]);
  });

  /**
   * Вынужденный отбой на уже пустом столе (движок так разбирает затор) ничего в отбой не кладёт —
   * иначе только что взятая нижняя улетала бы в отбой, лёжа при этом в руке.
   */
  it('ignores a forced vidbiy that sent nothing to the discard', () => {
    const onTable = phase2State({
      players: [{ id: 'A', hand: '6C' }, { id: 'B', hand: '7C' }, { id: 'C', hand: '8C' }],
      table: [['6D', 'B']],
      trump: 'D',
      turn: 'A',
    });
    const prev = makeUpdate(onTable, 'A');
    const stalled = makeUpdate(p2, 'A', {
      events: [{ type: 'tookBottom', playerId: 'A', card: c('6D') }, { type: 'vidbiy', closerId: 'A' }],
    });
    expect(sweptCards(prev, stalled)).toEqual([]);
  });

  it('gives a celebration beat only when somebody goes out on a table that is still on screen', () => {
    const playing = makeUpdate(p2, 'A');
    const result: GameResult = { loserId: 'B', winnerId: 'A', outOrder: ['A'], technical: false };
    const over = (events: ClientUpdate['events']) =>
      makeUpdate(p2, 'A', { session: { ...playing.session, status: 'gameOver' }, events });
    const wentOut = over([{ type: 'out', playerId: 'A' }, { type: 'gameOver', result }]);
    const technical = over([{ type: 'gameOver', result: { ...result, technical: true } }]);
    const hold = (next: ClientUpdate, prev: ClientUpdate | null = playing, speed = 1, reduced = false) =>
      celebrationHoldMs({ prev, next, speed, reduced });
    expect(hold(wentOut)).toBe(FX_MS);
    expect(hold(technical)).toBe(0);
    expect(hold(playing)).toBe(0);
    expect(hold(wentOut, null)).toBe(0);
    expect(hold(wentOut, wentOut)).toBe(0);
    // Очередь догоняет состояние — такт короче; «меньше движения» — без него вовсе.
    expect(hold(wentOut, playing, 2)).toBe(FX_MS / 2);
    expect(hold(wentOut, playing, 1, true)).toBe(0);
  });

  it('explains errors in Russian, with the spec wording for a bad beat', () => {
    expect(errorText('illegal_move', makeUpdate(p2, 'A').view)).toBe(ru.cannotBeat);
    const p1 = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }], deck: 'KD' });
    expect(errorText('illegal_move', makeUpdate(p1, 'A').view)).toBe(ru.errors.illegal_move);
    expect(errorText('not_your_turn', null)).toBe(ru.errors.not_your_turn);
  });

  it('keeps a phase 1 selection only while it still makes sense', () => {
    const drawn = phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }], deck: 'KD', drawn: 'TS' });
    const noDrawn = phase1State({ players: [{ id: 'A', stack: '6C 7H' }, { id: 'B', stack: '9C' }], deck: 'KD' });
    expect(keepSelection({ kind: 'drawn' }, makeUpdate(drawn, 'A').view)).toEqual({ kind: 'drawn' });
    expect(keepSelection({ kind: 'drawn' }, makeUpdate(noDrawn, 'A').view)).toBeNull();
    expect(keepSelection({ kind: 'ownTop' }, makeUpdate(noDrawn, 'A').view)).toEqual({ kind: 'ownTop' });
    expect(keepSelection({ kind: 'ownTop' }, makeUpdate(drawn, 'A').view)).toBeNull();
    expect(keepSelection({ kind: 'drawn' }, makeUpdate(drawn, 'B').view)).toBeNull();
  });
});

describe('actingFrom', () => {
  const p1 = phase1State({ players: [{ id: 'A', stack: '6C' }, { id: 'B', stack: '7C' }, { id: 'C', stack: '8C' }], deck: 'TS 9D' });
  const names = { A: 'Вася', B: 'Боря', C: 'Галя' };
  const acting = (state: typeof p1, events: ClientUpdate['events']) =>
    actingFrom(makeUpdate(state, 'A', { players: seatsFor(state, names), events }), 7);

  it('names who acted and what they did', () => {
    expect(acting(p1, [{ type: 'drew', playerId: 'B', card: c('TS') }])).toEqual({ id: 'B', text: 'вытянул', seq: 7 });
    expect(acting(p1, [{ type: 'placed', playerId: 'B', to: 'C', card: c('TS') }])).toEqual({ id: 'B', text: 'переложил Гале', seq: 7 });
    expect(acting(p1, [{ type: 'movedTop', from: 'C', to: 'B', card: c('8C') }])).toEqual({ id: 'C', text: 'переложил Боре', seq: 7 });
    expect(acting(p1, [{ type: 'kept', playerId: 'B', card: c('TS') }])).toEqual({ id: 'B', text: 'оставил себе', seq: 7 });
    expect(acting(p2, [{ type: 'played', playerId: 'C', card: c('8C') }])).toEqual({ id: 'C', text: 'побил', seq: 7 });
    expect(acting(p2, [{ type: 'tookBottom', playerId: 'A', card: c('6C') }])).toEqual({ id: 'A', text: 'взял нижнюю', seq: 7 });
  });

  it('«+1» на свою же стопку — это «оставил себе», а не «переложил себе»', () => {
    expect(acting(p1, [{ type: 'placed', playerId: 'B', to: 'B', card: c('TS') }])).toEqual({ id: 'B', text: 'оставил себе', seq: 7 });
  });

  it('ignores updates without an action of a player', () => {
    expect(acting(p1, [])).toBeNull();
    expect(acting(p2, [{ type: 'vidbiy', closerId: 'C' }, { type: 'out', playerId: 'C' }])).toBeNull();
  });

  it('takes the action itself, not what it caused', () => {
    expect(
      acting(p2, [
        { type: 'played', playerId: 'C', card: c('8C') },
        { type: 'vidbiy', closerId: 'C' },
        { type: 'out', playerId: 'C' },
      ]),
    ).toEqual({ id: 'C', text: 'побил', seq: 7 });
  });
});
