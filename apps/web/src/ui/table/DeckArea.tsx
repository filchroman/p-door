import type { Card } from '@vakhta/engine';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { AnimatedCard } from '../anim/AnimatedCard';
import { FlipIn } from '../anim/FlipIn';
import { FlyFrom } from '../anim/FlyFrom';
import { DraggableCard } from './DraggableCard';
import { layerOffset } from './layers';
import { DECK_CAP, zoneProps } from './zones';

/** Вытянутая карта летит от колоды к своему месту справа от неё — видимой траекторией (спека §2c). */
const DECK_ZONE = 'deck';

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
        {/* Колода — это высота и цифра: рубашек рисуется не больше DECK_CAP (спека §2c.2),
            дальше слои всё равно не видно, а тридцать `<img>` браузер держит впустую. */}
        <span className="deck__pile" {...zoneProps('deck', count, Math.min(count, DECK_CAP))}>
          {Array.from({ length: Math.min(count, DECK_CAP) }, (_, i) => (
            <span key={i} className="stack-layer" style={layerOffset(i)}>
              <PlayingCard card={null} />
            </span>
          ))}
        </span>
        <span className="deck__count">{count}</span>
      </button>
      {/* Место под вытянутую занято всегда: её появление ничего не двигает (спека §2c). */}
      <div className="drawn-slot" {...zoneProps('drawn', drawn ? 1 : 0)}>
        {/* Вытянутая переворачивается прямо в полёте (§2b): рубашка отрывается от колоды и
            приземляется лицом — поэтому переворот живёт и в летящей копии, и в приёмнике. */}
        {drawn && (
          <FlyFrom
            key={cardKey(drawn)}
            from={DECK_ZONE}
            ghost={
              <FlipIn flip>
                <PlayingCard card={drawn} />
              </FlipIn>
            }
          >
            <FlipIn flip>
              {drawnDraggable ? (
                <DraggableCard card={drawn} selected={drawnSelected} onTap={onDrawnTap} onDrop={onDrawnDrop} accept={accept} enter={false} />
              ) : (
                <AnimatedCard id={cardKey(drawn)} enter={false}>
                  <PlayingCard card={drawn} />
                </AnimatedCard>
              )}
            </FlipIn>
          </FlyFrom>
        )}
      </div>
    </div>
  );
}
