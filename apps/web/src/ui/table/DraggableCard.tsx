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
  /**
   * false — карту сейчас нельзя ни тащить, ни выбрать, но элемент остаётся тем же: переключение
   * на другой компонент пересоздавало карту, и она заново «падала сверху» при каждом вытягивании.
   */
  enabled?: boolean;
  /** Карта не обмеряет свою раскладку (стопка фазы 1 не перестраивается): перелёты играет FlyFrom. */
  carried?: boolean;
}

export function DraggableCard({ card, selected, onTap, onDrop, accept, enter, enabled = true, carried = false }: DraggableCardProps) {
  const drag = useDrag({ onTap, onDrop, accept });
  const classes = ['draggable', enabled ? '' : 'is-idle', selected ? 'is-selected' : '', drag.dragging ? 'is-dragging' : ''].filter(Boolean).join(' ');
  return (
    <div className={classes} role={enabled ? 'button' : undefined} aria-pressed={enabled ? selected : undefined} aria-label={enabled ? cardLabel(card) : undefined} {...(enabled ? drag.handlers : {})}>
      <AnimatedCard id={cardKey(card)} enter={enter} carried={carried}>
        <PlayingCard card={card} />
      </AnimatedCard>
    </div>
  );
}
