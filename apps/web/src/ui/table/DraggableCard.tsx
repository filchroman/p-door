import type { Card } from '@vakhta/engine';
import { cardKey, cardLabel } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { AnimatedCard } from '../anim/AnimatedCard';
import { useDrag } from './useDrag';

export interface DraggableCardProps {
  card: Card;
  selected: boolean;
  onTap(): void;
  onDrop(target: string): void;
  accept?: (id: string) => boolean;
  /** false — появление карты показывает обёртка FlyFrom. */
  enter?: boolean;
}

export function DraggableCard({ card, selected, onTap, onDrop, accept, enter }: DraggableCardProps) {
  const drag = useDrag({ onTap, onDrop, accept });
  const classes = ['draggable', selected ? 'is-selected' : '', drag.dragging ? 'is-dragging' : ''].filter(Boolean).join(' ');
  return (
    <div className={classes} role="button" aria-pressed={selected} aria-label={cardLabel(card)} {...drag.handlers}>
      <AnimatedCard id={cardKey(card)} enter={enter}>
        <PlayingCard card={card} />
      </AnimatedCard>
    </div>
  );
}
