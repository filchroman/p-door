import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore } from '../../test/updates';
import { FlipIn } from './FlipIn';
import { FLIP_MS } from './motion';

// Длительность перехода наружу не видна: подменяем motion.div, чтобы прочитать её в DOM.
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    motion: {
      div: ({ className, transition, children }: { className?: string; transition?: { duration: number }; children: ReactNode }) => (
        <div className={className} data-duration={String(transition?.duration)}>
          {children}
        </div>
      ),
    },
  };
});

beforeEach(() => resetStore({ motionEnabled: true }));

describe('FlipIn', () => {
  it('flips in FLIP_MS and speeds up with the update queue, like every other card motion', () => {
    const flip = () => (
      <FlipIn flip>
        <span>лицо</span>
      </FlipIn>
    );
    const { container, rerender } = render(flip());
    expect(container.querySelector('.flip-in')).toHaveAttribute('data-duration', String(FLIP_MS / 1000));
    resetStore({ motionEnabled: true, animSpeed: 2 });
    rerender(flip());
    expect(container.querySelector('.flip-in')).toHaveAttribute('data-duration', String(FLIP_MS / 1000 / 2));
  });
});
