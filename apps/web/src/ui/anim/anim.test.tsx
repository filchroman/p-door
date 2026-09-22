import { act, render, screen, waitFor } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore } from '../../test/updates';
import { AnimatedCard } from './AnimatedCard';
import { FlipIn } from './FlipIn';

beforeEach(() => resetStore({ motionEnabled: true }));

describe('animation primitives', () => {
  it('FlipIn shows a back face behind the card while flipping', () => {
    const { container, rerender } = render(<FlipIn flip><span>лицо</span></FlipIn>);
    expect(container.querySelector('.flip-in')).not.toBeNull();
    expect(container.querySelector('.flip-in__back img')).not.toBeNull();
    expect(screen.getByText('лицо')).toBeInTheDocument();
    rerender(<FlipIn flip={false}><span>лицо</span></FlipIn>);
    expect(container.querySelector('.flip-in')).toBeNull();
    expect(screen.getByText('лицо')).toBeInTheDocument();
  });

  it('AnimatedCard keeps classes and CSS variables; will-change only while it animates', async () => {
    render(
      <AnimatedCard id="9H" className="table-card is-top" style={{ '--i': 2 } as CSSProperties}>
        <span>карта</span>
      </AnimatedCard>,
    );
    const el = screen.getByText('карта').parentElement!;
    expect(el).toHaveClass('animated-card', 'table-card', 'is-top');
    expect(el.style.getPropertyValue('--i')).toBe('2');
    await waitFor(() => expect(el.style.willChange).not.toBe('transform'), { timeout: 2000 });
  });

  it('with animations disabled AnimatedCard is a plain div', () => {
    resetStore({ motionEnabled: false });
    render(<AnimatedCard id="9H"><span>карта</span></AnimatedCard>);
    const el = screen.getByText('карта').parentElement!;
    expect(el.getAttribute('style')).toBeNull();
  });

  it('a card gone from the slice is gone from the DOM the same frame — nothing doubles as a ghost', async () => {
    const table = (ids: string[]) => (
      <>
        {ids.map((id) => (
          <AnimatedCard key={id} id={id}>
            <span>{id}</span>
          </AnimatedCard>
        ))}
      </>
    );
    const { rerender } = render(table(['9H', 'JH']));
    rerender(table(['JH']));
    await act(async () => {});
    expect(screen.queryByText('9H')).toBeNull();
    expect(screen.getByText('JH')).toBeInTheDocument();
    rerender(table([]));
    await act(async () => {});
    expect(screen.queryByText('JH')).toBeNull();
  });
});
