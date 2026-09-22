import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayingCard, samePlayingCardProps } from './PlayingCard';

describe('PlayingCard', () => {
  it('shows the Atlas face as an async-decoded image named in Russian', () => {
    render(<PlayingCard card={{ rank: 12, suit: 'H' }} />);
    const img = screen.getByRole('img', { name: 'Д♥' });
    expect(img).toHaveAttribute('src', expect.stringMatching(/QH\.webp/));
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('draggable', 'false');
    expect(img.closest('.card')).not.toBeNull();
  });

  it('names tens, aces, jacks and kings in Russian', () => {
    render(
      <>
        <PlayingCard card={{ rank: 10, suit: 'C' }} />
        <PlayingCard card={{ rank: 14, suit: 'S' }} />
        <PlayingCard card={{ rank: 11, suit: 'D' }} />
        <PlayingCard card={{ rank: 13, suit: 'C' }} />
      </>,
    );
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['10♣', 'Т♠', 'В♦', 'К♣']);
  });

  it('shows the Atlas back for hidden cards, invisible to screen readers', () => {
    const { container } = render(
      <>
        <PlayingCard card={null} />
        <PlayingCard card={{ rank: 9, suit: 'D' }} faceDown />
      </>,
    );
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs).toHaveLength(2);
    for (const img of imgs) expect(img.getAttribute('src')).toMatch(/back\.webp/);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('memo treats equal cards as equal props', () => {
    expect(samePlayingCardProps({ card: { rank: 9, suit: 'D' } }, { card: { rank: 9, suit: 'D' } })).toBe(true);
    expect(samePlayingCardProps({ card: { rank: 9, suit: 'D' } }, { card: { rank: 9, suit: 'H' } })).toBe(false);
    expect(samePlayingCardProps({ card: null }, { card: null, faceDown: false })).toBe(true);
    expect(samePlayingCardProps({ card: null, className: 'a' }, { card: null, className: 'b' })).toBe(false);
  });
  it('renders a blank paper card without an image', () => {
    const { container } = render(<PlayingCard card={null} blank />);
    expect(container.querySelector('.card.card--blank')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
