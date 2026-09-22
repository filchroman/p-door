import type { TableCard } from '@vakhta/engine';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../store/appStore';
import { c } from '../../test/states';
import { resetStore } from '../../test/updates';
import { TableFan } from './TableFan';

const table = (cards: string[]): TableCard[] => cards.map((card) => ({ card: c(card), by: 'B' }));
const nine = () => screen.queryByRole('img', { name: '9♥' });
/** Пропустить микрозадачи, не двигая время: анимация exit за это время не успевает. */
const settle = () => act(async () => {});

beforeEach(() => resetStore({ motionEnabled: true }));

describe('TableFan: how a card leaves the table', () => {
  it('a taken bottom card leaves at once — it travels into the hand as one element by its shared layoutId', async () => {
    useAppStore.setState({ tableSweep: false });
    const { rerender } = render(<TableFan table={table(['9H', 'JH'])} />);
    expect(nine()).not.toBeNull();
    rerender(<TableFan table={table(['JH'])} />);
    await settle();
    expect(nine()).toBeNull();
    expect(screen.getByRole('img', { name: 'В♥' })).toBeInTheDocument();
  });

  it('a vidbiy sweep flies away: the cards stay on screen until the exit has played', async () => {
    useAppStore.setState({ tableSweep: true });
    const { rerender } = render(<TableFan table={table(['9H', 'JH'])} />);
    rerender(<TableFan table={[]} />);
    await settle();
    expect(nine()).not.toBeNull();
    await waitFor(() => expect(nine()).toBeNull(), { timeout: 2000 });
  });
});
