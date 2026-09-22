import type { PublicPlayer } from '@vakhta/engine';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { AnimatedCard } from '../anim/AnimatedCard';
import { FlyFrom } from '../anim/FlyFrom';
import { DraggableCard } from './DraggableCard';
import { layerOffset } from './layers';
import { Prykup } from './Prykup';
import { STACK_CAP, zoneProps } from './zones';

export interface PileProps {
  player: PublicPlayer;
  targetable: boolean;
  onTarget(): void;
  topDraggable: boolean;
  topSelected: boolean;
  onTopTap(): void;
  onTopDrop(target: string): void;
  accept: (id: string) => boolean;
}

/** Открытая стопка фазы 1: ровно stackCount карт (видна верхняя), высота и закрытый прикуп. */
export function Pile({ player, targetable, onTarget, topDraggable, topSelected, onTopTap, onTopDrop, accept }: PileProps) {
  const top = player.stackTop;
  const topKey = top ? cardKey(top) : '';
  // Карта не появляется на стопке из ниоткуда: она прилетает оттуда, где лежала (спека §2c.1).
  const flight = useAppStore((s) => (topKey ? (s.flights.cards[topKey] ?? null) : null));
  // Стопка показывает высоту, а не каждую карту: сверху видна верхняя, под ней — не больше
  // STACK_CAP слоёв (спека §2c.2), точная высота стоит рядом цифрой.
  const shown = Math.min(player.stackCount, STACK_CAP);
  const under = Math.max(0, shown - (top ? 1 : 0));
  const classes = ['pile', targetable ? 'is-targetable' : ''].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      data-drop={player.id}
      data-testid={`pile-${player.id}`}
      onClick={(e) => {
        e.stopPropagation();
        if (targetable) onTarget();
      }}
    >
      <div className="pile__stack" aria-label={ru.table.stack(player.stackCount)} {...zoneProps(`stack-${player.id}`, player.stackCount, shown)}>
        {Array.from({ length: under }, (_, i) => (
          <div key={i} className="stack-layer" style={layerOffset(i)}>
            <PlayingCard card={null} blank />
          </div>
        ))}
        {top && (
          <div className="stack-layer" style={layerOffset(under)}>
            <FlyFrom key={topKey} from={flight} ghost={<PlayingCard card={top} />}>
              {topDraggable ? (
                <DraggableCard card={top} selected={topSelected} onTap={onTopTap} onDrop={onTopDrop} accept={accept} enter={!flight} />
              ) : (
                <AnimatedCard id={topKey} enter={!flight}>
                  <PlayingCard card={top} />
                </AnimatedCard>
              )}
            </FlyFrom>
          </div>
        )}
      </div>
      <span className="pile__count">{player.stackCount}</span>
      <Prykup owner={player.id} count={player.prykupCount} />
    </div>
  );
}
