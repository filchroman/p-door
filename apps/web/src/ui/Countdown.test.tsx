import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from './Countdown';

beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => vi.useRealTimers());

describe('Countdown', () => {
  it('is a CSS animation set up once per deadline', () => {
    const { rerender } = render(<Countdown endsAt={10_000} totalMs={15_000} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveAttribute('aria-label', '10 с');
    expect(timer.style.getPropertyValue('--countdown-total')).toBe('15000ms');
    expect(timer.style.getPropertyValue('--countdown-delay')).toBe('-5000ms');
    vi.advanceTimersByTime(3000);
    rerender(<Countdown endsAt={10_000} totalMs={15_000} />);
    expect(screen.getByRole('timer').style.getPropertyValue('--countdown-delay')).toBe('-5000ms');
    expect(screen.getByRole('timer').querySelector('.countdown__bar')).not.toBeNull();
  });

  it('renders nothing without a deadline', () => {
    const { container } = render(<Countdown endsAt={null} totalMs={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
