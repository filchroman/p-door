import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { phase1State } from '../../test/states';
import { makeUpdate, resetStore } from '../../test/updates';
import { Phase1Screen } from './Phase1Screen';
import { DROP_HOLD_MS } from './useDrag';
import { zoneMismatches } from './zones';

const send = vi.fn();
const show = (state: ReturnType<typeof phase1State>, me = 'A') => {
  resetStore({ update: makeUpdate(state, me), send });
  return render(<Phase1Screen />);
};
const rect = (el: Element, left: number, top: number) => {
  el.getBoundingClientRect = () => ({ left, top, right: left + 60, bottom: top + 90, width: 60, height: 90, x: left, y: top, toJSON: () => ({}) });
};

beforeEach(() => {
  send.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('Phase1Screen', () => {
  it('tap on the deck draws', () => {
    show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }, { id: 'C', stack: 'KD' }], deck: 'AS 8C 9D' }));
    fireEvent.click(screen.getByRole('button', { name: ru.table.deckLabel(3) }));
    expect(send).toHaveBeenCalledWith({ type: 'draw' });
    fireEvent.click(screen.getByRole('button', { name: ru.table.draw }));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('shows exactly as many cards as the view says in the deck, stacks and prykups', () => {
    const state = phase1State({
      players: [{ id: 'A', stack: '6C 9H 7D', prykup: '2C 3C' }, { id: 'B', stack: '8D', prykup: 'AS AH AD' }],
      deck: 'QS JD 7C 8S',
      drawn: 'TS',
    });
    const { container } = show(state);
    const count = (zone: string) => container.querySelectorAll(`[data-zone="${zone}"] .card`).length;
    expect(count('deck')).toBe(4);
    expect(count('drawn')).toBe(1);
    expect(count('stack-A')).toBe(3);
    expect(count('stack-B')).toBe(1);
    // Прикуп — только цифрой на рамке: карт в его зоне нет, число объявлено точно.
    expect(count('prykup-A')).toBe(0);
    expect(count('prykup-B')).toBe(0);
    expect(container.querySelector('[data-zone="prykup-B"]')).toHaveTextContent('3');
    expect(zoneMismatches(container, makeUpdate(state, 'A').view).filter((m) => !m.startsWith('total'))).toEqual([]);
    expect(screen.getByTestId('pile-A')).toHaveTextContent('3');
  });

  it('keeps the drawn card slot reserved so nothing reflows when a card appears', () => {
    const players = [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }];
    const empty = show(phase1State({ players, deck: 'AS 8C 9D' }));
    const emptySlot = empty.container.querySelector('.drawn-slot')!;
    expect(emptySlot).not.toBeNull();
    expect(emptySlot.querySelectorAll('.card')).toHaveLength(0);
    empty.unmount();
    const filled = show(phase1State({ players, deck: '8C 9D', drawn: 'AS' }));
    const filledSlot = filled.container.querySelector('.drawn-slot')!;
    // Место под вытянутую карту — та же коробка рядом с колодой, а не прибавка к раскладке.
    expect(filledSlot.className).toBe(emptySlot.className);
    expect(filledSlot.previousElementSibling!.className).toBe('deck');
    expect(filledSlot.querySelectorAll('.card')).toHaveLength(1);
  });

  /**
   * У каждой подвижной карты есть имя: по нему перелёт находит её место на прошлом кадре
   * (`flights.ts`), а веер и стопка — саму карту. Потеряет имя — перелетать будет нечему,
   * и карта снова начнёт телепортироваться (спека §2c.1).
   */
  it('every card that can move carries its own name', () => {
    const state = phase1State({
      players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }, { id: 'C', stack: 'KD' }],
      deck: 'QS JD',
      drawn: 'TS',
    });
    resetStore({ update: makeUpdate(state, 'A'), send, motionEnabled: true });
    const { container } = render(<Phase1Screen />);
    const idOf = (zone: string) => container.querySelector(`[data-zone="${zone}"] [data-card]`)?.getAttribute('data-card');
    expect(idOf('stack-A')).toBe('9H');
    expect(idOf('stack-B')).toBe('8D');
    expect(idOf('stack-C')).toBe('KD');
    expect(idOf('drawn')).toBe('TS');
  });

  it('an empty deck shows no cards but keeps its counter', () => {
    const { container } = show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: 'QC' }], deck: '' }));
    expect(container.querySelectorAll('[data-zone="deck"] .card')).toHaveLength(0);
    expect(screen.getByRole('button', { name: ru.table.deckLabel(0) })).toHaveTextContent('0');
  });

  it('tap the drawn card, then tap a stack: placeDrawn', () => {
    show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }, { id: 'C', stack: 'KD' }], deck: 'QH 8C', drawn: 'TS' }));
    expect(screen.getByRole('button', { name: ru.table.deckLabel(2) })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '10♠' }));
    expect(useAppStore.getState().selection).toEqual({ kind: 'drawn' });
    fireEvent.click(screen.getByTestId('pile-B'));
    expect(send).toHaveBeenCalledWith({ type: 'placeDrawn', to: 'B' });
  });

  it('a tap away from the stacks cancels the selection', () => {
    const { container } = show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }], deck: 'QH 8C', drawn: 'TS' }));
    fireEvent.click(screen.getByRole('button', { name: '10♠' }));
    fireEvent.click(container.querySelector('.my-area')!);
    expect(useAppStore.getState().selection).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('dragging the drawn card near a stack snaps it there', () => {
    show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }, { id: 'C', stack: 'KD' }], deck: 'QH 8C', drawn: 'TS' }));
    rect(screen.getByTestId('pile-A'), 0, 500);
    rect(screen.getByTestId('pile-B'), 0, 0);
    rect(screen.getByTestId('pile-C'), 300, 0);
    const card = screen.getByRole('button', { name: '10♠' });
    fireEvent.pointerDown(card, { clientX: 150, clientY: 250, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 100, clientY: 120, pointerId: 1 });
    expect(card).toHaveClass('is-dragging');
    expect(card.style.transform).toBe('translate(-50px, -130px)');
    expect(screen.getByTestId('pile-B')).toHaveClass('is-snap');
    fireEvent.pointerUp(card, { clientX: 100, clientY: 120, pointerId: 1 });
    // Перетащил сам — стор знает об этом и не повезёт карту к цели второй раз.
    expect(send).toHaveBeenCalledWith({ type: 'placeDrawn', to: 'B' }, { dragged: true });
    // Карта остаётся лежать у цели (в центре зоны), а не отпрыгивает назад в слот.
    expect(card.style.transform).toBe('translate(30px, 45px)');
    expect(card).toHaveClass('is-dropped');
    expect(screen.getByTestId('pile-B')).not.toHaveClass('is-snap');
    // Если срез так и не пришёл (хост отверг ход), карта возвращается сама.
    act(() => vi.advanceTimersByTime(DROP_HOLD_MS));
    expect(card.style.transform).toBe('');
  });

  it('a non-primary button neither drags nor plays', () => {
    show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }], deck: 'QH 8C', drawn: 'TS' }));
    rect(screen.getByTestId('pile-A'), 0, 500);
    rect(screen.getByTestId('pile-B'), 0, 0);
    const card = screen.getByRole('button', { name: '10♠' });
    fireEvent.pointerDown(card, { clientX: 150, clientY: 250, pointerId: 1, button: 2 });
    fireEvent.pointerMove(card, { clientX: 100, clientY: 120, pointerId: 1 });
    expect(card).not.toHaveClass('is-dragging');
    expect(card.style.transform).toBe('');
    expect(screen.getByTestId('pile-B')).not.toHaveClass('is-snap');
    fireEvent.pointerUp(card, { clientX: 100, clientY: 120, pointerId: 1, button: 2 });
    expect(send).not.toHaveBeenCalled();
  });

  it('a lost pointer capture puts the card back instead of leaving it mid-flight', () => {
    show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }], deck: 'QH 8C', drawn: 'TS' }));
    rect(screen.getByTestId('pile-A'), 0, 500);
    rect(screen.getByTestId('pile-B'), 0, 0);
    const card = screen.getByRole('button', { name: '10♠' });
    fireEvent.pointerDown(card, { clientX: 150, clientY: 250, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 100, clientY: 120, pointerId: 1 });
    expect(card).toHaveClass('is-dragging');
    fireEvent.lostPointerCapture(card, { pointerId: 1 });
    expect(card).not.toHaveClass('is-dragging');
    expect(card.style.transform).toBe('');
    expect(screen.getByTestId('pile-B')).not.toHaveClass('is-snap');
    expect(send).not.toHaveBeenCalled();
  });

  it('a drag released far from every stack sends nothing', () => {
    show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }], deck: 'QH 8C', drawn: 'TS' }));
    rect(screen.getByTestId('pile-A'), 0, 500);
    rect(screen.getByTestId('pile-B'), 0, 0);
    const card = screen.getByRole('button', { name: '10♠' });
    fireEvent.pointerDown(card, { clientX: 400, clientY: 250, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 420, clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 420, clientY: 260, pointerId: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it('my top card (stack of 2+) can be moved onto an opponent stack', () => {
    show(phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }, { id: 'C', stack: 'KD' }], deck: 'QS JD' }));
    fireEvent.click(screen.getByRole('button', { name: '9♥' }));
    expect(useAppStore.getState().selection).toEqual({ kind: 'ownTop' });
    fireEvent.click(screen.getByTestId('pile-B'));
    expect(send).toHaveBeenCalledWith({ type: 'moveOwnTop', to: 'B' });
  });

  it('gives no +1 hints: every stack becomes a target equally', () => {
    show(phase1State({ players: [{ id: 'A', stack: '7H' }, { id: 'B', stack: '9C' }, { id: 'C', stack: 'KD' }], deck: 'QH 8C', drawn: 'TS' }));
    expect(screen.getByTestId('pile-B')).not.toHaveClass('is-targetable');
    fireEvent.click(screen.getByRole('button', { name: '10♠' }));
    for (const id of ['A', 'B', 'C']) expect(screen.getByTestId(`pile-${id}`)).toHaveClass('is-targetable');
  });

  it('nothing is interactive when it is not my turn', () => {
    show(phase1State({ players: [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: '8D' }], deck: 'QS JD', drawn: 'TS', turn: 'B' }));
    expect(screen.getByRole('button', { name: ru.table.deckLabel(2) })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '10♠' })).toBeNull();
    expect(screen.queryByRole('button', { name: '9♥' })).toBeNull();
    expect(screen.getByRole('img', { name: '10♠' })).toBeInTheDocument();
  });
});

describe('своя стопка при вытягивании (баг заказчика: «прыгают карты»)', () => {
  it('верхняя карта — один и тот же элемент до и после вытягивания, заново она не появляется', () => {
    const players = [{ id: 'A', stack: '6C 9H' }, { id: 'B', stack: 'QC' }];
    const { container, rerender } = show(phase1State({ players, deck: 'AS 8C 9D' }));
    const before = container.querySelector('.my-area .pile__stack .animated-card');
    expect(before).not.toBeNull();
    // Вытянул: перекладывать свою верхнюю сейчас нельзя, но карта от этого не пересоздаётся.
    resetStore({ update: makeUpdate(phase1State({ players, deck: '8C 9D', drawn: 'AS' }), 'A'), send });
    rerender(<Phase1Screen />);
    const after = container.querySelector('.my-area .pile__stack .animated-card');
    expect(after).toBe(before);
  });
});
