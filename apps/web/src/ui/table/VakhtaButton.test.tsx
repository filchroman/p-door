import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../../i18n/ru';
import { phase1State } from '../../test/states';
import { makeUpdate, resetStore } from '../../test/updates';
import { VakhtaButton } from './VakhtaButton';

// Окно Вахты A открыто (A только что оставил карту себе).
const state = {
  ...phase1State({ players: [{ id: 'A', stack: '7H TS' }, { id: 'B', stack: '9C' }], deck: 'KD 8C', turn: 'B' }),
  watches: [{ id: 1, playerId: 'A', at: 0, violated: true, called: false, othersActed: false }],
};

beforeEach(() => resetStore());
afterEach(() => Reflect.deleteProperty(navigator, 'vibrate'));

describe('VakhtaButton', () => {
  it('is visible only while view.vakhtaOpen', () => {
    resetStore({ update: makeUpdate(state, 'A') });
    const { rerender } = render(<VakhtaButton />);
    expect(screen.queryByRole('button', { name: ru.table.vakhta })).toBeNull();
    resetStore({ update: makeUpdate(state, 'B') });
    rerender(<VakhtaButton />);
    expect(screen.getByRole('button', { name: ru.table.vakhta })).toBeInTheDocument();
  });

  it('calls Vakhta and buzzes', () => {
    const send = vi.fn();
    const buzz = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: buzz, configurable: true });
    resetStore({ update: makeUpdate(state, 'B'), send });
    render(<VakhtaButton />);
    fireEvent.click(screen.getByRole('button', { name: ru.table.vakhta }));
    expect(send).toHaveBeenCalledWith({ type: 'callVakhta' });
    expect(buzz).toHaveBeenCalledWith([40, 30, 40]);
  });
});
