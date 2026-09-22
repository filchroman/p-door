import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../store/appStore';
import { resetStore } from '../test/updates';
import { TOAST_MS, Toasts } from './Toasts';

beforeEach(() => {
  vi.useFakeTimers();
  resetStore();
});
afterEach(() => vi.useRealTimers());

describe('Toasts', () => {
  it('shows a plaque and hides it after 2.5 s', () => {
    render(<Toasts />);
    act(() => useAppStore.getState().pushToast('Ложная тревога', 'info'));
    expect(screen.getByRole('status')).toHaveTextContent('Ложная тревога');
    expect(screen.getByRole('status')).toHaveClass('toast--info');
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
