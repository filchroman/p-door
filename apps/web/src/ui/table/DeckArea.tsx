import type { Card } from '@vakhta/engine';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { AnimatedCard } from '../anim/AnimatedCard';
import { FlipIn } from '../anim/FlipIn';
import { DraggableCard } from './DraggableCard';
import { layerOffset } from './layers';
import { zoneProps } from './zones';

export interface DeckAreaProps {
  count: number;
  drawn: Card | null;
  canDraw: boolean;
  drawnDraggable: boolean;
  drawnSelected: boolean;
  onDraw(): void;
  onDrawnTap(): void;
  onDrawnDrop(target: string): void;
  accept: (id: string) => boolean;
}

/** Колода: ровно count рубашек и цифра; вытянутая карта появляется рядом с переворотом. */
export function DeckArea({ count, drawn, canDraw, drawnDraggable, drawnSelected, onDraw, onDrawnTap, onDrawnDrop, accept }: DeckAreaProps) {
  return (
    <div className="deck-area">
      <button
        type="button"
        className="deck"
        disabled={!canDraw}
        onClick={(e) => {
          e.stopPropagation();
          onDraw();
        }}
        aria-label={ru.table.deckLabel(count)}
      >
        <span className="deck__pile" {...zoneProps('deck', count)}>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className="stack-layer" style={layerOffset(i)}>
              <PlayingCard card={null} />
            </span>
          ))}
        </span>
        <span className="deck__count">{count}</span>
      </button>
      <div className="drawn-slot" {...zoneProps('drawn', drawn ? 1 : 0)}>
        {drawn && (
          <FlipIn key={cardKey(drawn)} flip>
            {drawnDraggable ? (
              <DraggableCard card={drawn} selected={drawnSelected} onTap={onDrawnTap} onDrop={onDrawnDrop} accept={accept} />
            ) : (
              <AnimatedCard id={cardKey(drawn)}>
                <PlayingCard card={drawn} />
              </AnimatedCard>
            )}
          </FlipIn>
        )}
      </div>
    </div>
  );
}
