import { describe, expect, it } from 'vitest';
import { c } from '../../test/states';
import { formatLogEntry } from './formatLog';

describe('formatLogEntry', () => {
  it('prints time, actor, action and event types', () => {
    const line = formatLogEntry({
      at: 3_723_000,
      playerId: 'p1',
      action: { type: 'draw' },
      events: [{ type: 'drew', playerId: 'p1', card: c('9S') }, { type: 'trump', suit: 'D', card: c('9S') }],
    });
    expect(line).toBe('01:02:03 p1 {"type":"draw"} → drew, trump');
  });

  it('prints errors and notes', () => {
    expect(formatLogEntry({ at: 0, playerId: 'p0', action: { type: 'take' }, events: [], error: 'wrong_phase' })).toBe(
      '00:00:00 p0 {"type":"take"} ✗ wrong_phase',
    );
    expect(formatLogEntry({ at: 0, playerId: null, action: null, events: [], note: 'game 2' })).toBe('00:00:00 - game 2');
  });
});
