import type { TableCard } from '@vakhta/engine';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../store/appStore';
import { c } from '../../test/states';
import { resetStore } from '../../test/updates';
import { TableFan } from './TableFan';

const table = (cards: string[]): TableCard[] => cards.map((card) => ({ card: c(card), by: 'B' }));
const nine = () => screen.queryByRole('img', { name: '9♥' });
/** Пропустить микрозадачи, не двигая время: анимации за это время не успевают. */
const settle = () => act(async () => {});
const inZone = (root: ParentNode) => root.querySelector<HTMLElement>('[data-zone="table"]')!.querySelectorAll('.card').length;

beforeEach(() => resetStore({ motionEnabled: true }));

describe('TableFan: how a card leaves the table', () => {
  it('a taken bottom card leaves at once — it travels into the hand as one element by its shared layoutId', async () => {
    const { container, rerender } = render(<TableFan table={table(['9H', 'JH'])} />);
    expect(nine()).not.toBeNull();
    rerender(<TableFan table={table(['JH'])} />);
    await settle();
    expect(nine()).toBeNull();
    expect(inZone(container)).toBe(1);
    expect(screen.getByRole('img', { name: 'В♥' })).toBeInTheDocument();
  });

  it('a vidbiy sweeps the table away in its own layer: the zone is empty at once, then nothing is left', async () => {
    const { container, rerender } = render(<TableFan table={table(['9H', 'JH'])} />);
    act(() => useAppStore.setState({ sweep: { seq: 1, cards: [c('9H'), c('JH')], ms: 300, landing: null } }));
    rerender(<TableFan table={[]} />);
    await settle();
    // Зона стола пуста уже сейчас — улетающие карты живут отдельным слоем поверх неё.
    expect(inZone(container)).toBe(0);
    // Слой aria-hidden: это эффект, а не карты стола, — в дереве доступности его нет.
    expect(container.querySelectorAll('.table-sweep .card')).toHaveLength(2);
    expect(nine()).toBeNull();
    // Слой снимается стором по своему таймеру — после него на столе не остаётся ничего.
    act(() => useAppStore.setState({ sweep: null }));
    await settle();
    expect(container.querySelectorAll('.card')).toHaveLength(0);
    expect(nine()).toBeNull();
  });

  it('a slice that arrives mid-sweep leaves no ghosts: the zone shows the new table, the layer only the old one', async () => {
    const { container, rerender } = render(<TableFan table={table(['9H', 'JH'])} />);
    act(() => useAppStore.setState({ sweep: { seq: 1, cards: [c('9H'), c('JH')], ms: 300, landing: null } }));
    rerender(<TableFan table={[]} />);
    await settle();
    // Следующий срез: кто-то уже положил карту на чистый стол, отбой ещё в полёте.
    act(() => useAppStore.setState({ animSpeed: 3 }));
    rerender(<TableFan table={table(['KH'])} />);
    await settle();
    expect(inZone(container)).toBe(1);
    act(() => useAppStore.setState({ sweep: null }));
    await settle();
    expect(container.querySelectorAll('.card')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'К♥' })).toBeInTheDocument();
  });
});
