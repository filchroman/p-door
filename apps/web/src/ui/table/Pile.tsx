import type { PublicPlayer } from '@vakhta/engine';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { AnimatedCard } from '../anim/AnimatedCard';
import { DraggableCard } from './DraggableCard';
import { layerOffset } from './layers';
import { Prykup } from './Prykup';
import { zoneProps } from './zones';

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
  const under = Math.max(0, player.stackCount - (top ? 1 : 0));
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
      <div className="pile__stack" aria-label={ru.table.stack(player.stackCount)} {...zoneProps(`stack-${player.id}`, player.stackCount)}>
        {Array.from({ length: under }, (_, i) => (
          <div key={i} className="stack-layer" style={layerOffset(i)}>
            <PlayingCard card={null} blank />
          </div>
        ))}
        {top && (
          <div className="stack-layer" style={layerOffset(under)}>
            {topDraggable ? (
              <DraggableCard card={top} selected={topSelected} onTap={onTopTap} onDrop={onTopDrop} accept={accept} />
            ) : (
              <AnimatedCard id={cardKey(top)}>
                <PlayingCard card={top} />
              </AnimatedCard>
            )}
          </div>
        )}
      </div>
      <span className="pile__count">{player.stackCount}</span>
      <Prykup owner={player.id} count={player.prykupCount} />
    </div>
  );
}
