import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { c, penaltyState, phase2State } from '../../test/states';
import { makeUpdate, resetStore } from '../../test/updates';
import { Hand } from './Hand';
import { OpponentHand } from './OpponentHand';
import { Phase2Screen } from './Phase2Screen';

const send = vi.fn();
const beatNine = () =>
  phase2State({ players: [{ id: 'A', hand: 'QH 7C 6D' }, { id: 'B', hand: 'KC AS' }, { id: 'C', hand: '8S' }], trump: 'D', turn: 'A', table: [['9H', 'B']] });
const cardIn = (name: string) => screen.getByRole('img', { name }).closest('.hand-card')!;
const player = (handCount: number) => ({ id: 'B', prykupCount: 0, stackTop: null, stackCount: 0, handCount, fouls: 0, out: false });

beforeEach(() => send.mockReset());

describe('Phase2Screen', () => {
  it('raises only legal moves and dims the rest on my turn', () => {
    resetStore({ update: makeUpdate(beatNine(), 'A'), send });
    render(<Phase2Screen />);
    expect(cardIn('Д♥')).toHaveClass('is-legal');
    expect(cardIn('6♦')).toHaveClass('is-legal');
    expect(cardIn('7♣')).not.toHaveClass('is-legal');
    expect(cardIn('7♣')).toHaveClass('is-dim');
    expect(screen.getByLabelText(ru.table.myHand).querySelectorAll('[data-legal="true"]')).toHaveLength(2);
  });

  it('plays a card by tap and takes the bottom by the button', () => {
    resetStore({ update: makeUpdate(beatNine(), 'A'), send });
    render(<Phase2Screen />);
    fireEvent.click(cardIn('Д♥'));
    expect(send).toHaveBeenCalledWith({ type: 'play', card: c('QH') });
    fireEvent.click(screen.getByRole('button', { name: ru.table.take }));
    expect(send).toHaveBeenCalledWith({ type: 'take' });
  });

  it('sends an illegal card too, so the host can explain why not', () => {
    resetStore({ update: makeUpdate(beatNine(), 'A'), send });
    render(<Phase2Screen />);
    fireEvent.click(cardIn('7♣'));
    expect(send).toHaveBeenCalledWith({ type: 'play', card: c('7C') });
  });

  it('"take the bottom" is disabled on an empty table', () => {
    const empty = phase2State({ players: [{ id: 'A', hand: 'QH 7C' }, { id: 'B', hand: 'KC' }], trump: 'D', turn: 'A' });
    resetStore({ update: makeUpdate(empty, 'A'), send });
    render(<Phase2Screen />);
    expect(screen.getByRole('button', { name: ru.table.take })).toBeDisabled();
    expect(cardIn('Д♥')).toHaveClass('is-legal');
    expect(cardIn('7♣')).toHaveClass('is-legal');
  });

  it('on a foreign turn nothing is raised, dimmed or playable', () => {
    const foreign = { ...beatNine(), turn: 'B' };
    resetStore({ update: makeUpdate(foreign, 'A'), send });
    render(<Phase2Screen />);
    expect(document.querySelectorAll('.hand-card.is-legal, .hand-card.is-dim')).toHaveLength(0);
    expect(screen.getByRole('button', { name: ru.table.take })).toBeDisabled();
    fireEvent.click(cardIn('Д♥'));
    expect(send).not.toHaveBeenCalled();
  });

  it('shows the table bottom-to-top with bottom and top marked', () => {
    const two = phase2State({
      players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: 'KC' }, { id: 'C', hand: '8S' }],
      trump: 'D', turn: 'C', table: [['9H', 'A'], ['JH', 'B']],
    });
    resetStore({ update: makeUpdate(two, 'A'), send });
    render(<Phase2Screen />);
    const table = screen.getByLabelText(ru.table.tableZone);
    expect(table).toHaveAttribute('data-drop', 'table');
    expect(table).toHaveAttribute('data-count', '2');
    expect(within(table).getByRole('img', { name: '9♥' }).closest('.table-card')).toHaveClass('is-bottom');
    expect(within(table).getByRole('img', { name: 'В♥' }).closest('.table-card')).toHaveClass('is-top');
    expect(screen.getByText(ru.table.toVidbiy(2, 3))).toBeInTheDocument();
  });

  it('opponents show card backs, or faces when all hands are shown', () => {
    const state = beatNine();
    resetStore({ update: makeUpdate(state, 'A'), send });
    const { unmount } = render(<Phase2Screen />);
    expect(screen.getByLabelText(ru.table.hand(2))).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Т♠' })).toBeNull();
    unmount();
    resetStore({ update: makeUpdate(state, 'A'), send, allHands: { A: [], B: [c('KC'), c('AS')], C: [c('8S')] } });
    render(<Phase2Screen />);
    expect(screen.getByRole('img', { name: 'Т♠' })).toBeInTheDocument();
  });

  it('while I owe penalty cards my hand lives in the penalty modal, not here', () => {
    const owing = penaltyState({ players: [{ id: 'A', hand: '6C 7C' }, { id: 'B', hand: 'AH', fouls: 1 }], trump: 'D', debts: [{ from: 'A', to: 'B', count: 1 }] });
    resetStore({ update: makeUpdate(owing, 'A'), send });
    const { container } = render(<Phase2Screen />);
    expect(container.querySelector('[data-zone="hand-A"]')).toBeNull();
  });
});

describe('OpponentHand: honest counts', () => {
  it.each([0, 1, 5, 33])('renders exactly %i backs and the number', (n) => {
    const { container } = render(<OpponentHand player={player(n)} cards={null} />);
    const zone = container.querySelector('[data-zone="hand-B"]')!;
    expect(zone.querySelectorAll('.card')).toHaveLength(n);
    expect(zone).toHaveAttribute('data-count', String(n));
    expect(container).toHaveTextContent(String(n));
  });
});

describe('Hand: narrow subscription', () => {
  it('does not re-render when only other players move', () => {
    const state = beatNine();
    resetStore({ update: makeUpdate({ ...state, turn: 'B' }, 'A'), send });
    const onRender = vi.fn();
    render(
      <Profiler id="hand" onRender={onRender}>
        <Hand />
      </Profiler>,
    );
    const renders = onRender.mock.calls.length;
    act(() => useAppStore.setState({ update: makeUpdate({ ...state, turn: 'C', table: [] }, 'A') }));
    expect(onRender.mock.calls.length).toBe(renders);
    act(() => useAppStore.setState({ update: makeUpdate({ ...state, turn: 'A' }, 'A') }));
    expect(onRender.mock.calls.length).toBeGreaterThan(renders);
  });

  it('a big hand moves as one container, cards keep exact count', () => {
    const big = phase2State({ players: [{ id: 'A', hand: '6C 7C 8C 9C TC JC QC KC' }, { id: 'B', hand: 'AS' }], trump: 'D', turn: 'B' });
    resetStore({ update: makeUpdate(big, 'A'), send });
    const { container } = render(<Hand />);
    expect(container.querySelectorAll('[data-zone="hand-A"] .card')).toHaveLength(8);
    expect(container.querySelector('[data-zone="hand-A"]')).toHaveAttribute('data-animate', 'group');
  });
});
