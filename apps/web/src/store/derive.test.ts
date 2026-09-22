import { describe, expect, it } from 'vitest';
import { ru } from '../i18n/ru';
import { c, phase1State, phase2State } from '../test/states';
import { makeUpdate, seatsFor } from '../test/updates';
import { FX_MS, emptyMarks, errorText, eventToasts, isFresh, keepSelection, nextMarks } from './derive';

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

  it('remembers who took, who beat, trump card and opened prykups', () => {
    let marks = nextMarks(emptyMarks(1), makeUpdate(p2, 'A', {
      events: [
        { type: 'trump', suit: 'D', card: c('9D') },
        { type: 'played', playerId: 'A', card: c('6C') },
        { type: 'tookBottom', playerId: 'B', card: c('6C') },
      ],
    }));
    expect(marks.acts).toEqual({ A: 'beat', B: 'took' });
    expect(marks.trumpCard).toEqual(c('9D'));
    marks = nextMarks(marks, makeUpdate(p2, 'A', { events: [{ type: 'vidbiy', closerId: 'C' }, { type: 'prykupOpened', playerId: 'C' }] }));
    expect(marks.acts).toEqual({});
    expect(marks.opened).toEqual(['C']);
    expect(marks.trumpCard).toEqual(c('9D'));
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
