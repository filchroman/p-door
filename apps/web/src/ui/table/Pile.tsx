import type { PublicPlayer } from '@vakhta/engine';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { AnimatedCard } from '../anim/AnimatedCard';
import { FlipIn } from '../anim/FlipIn';
import { FlyFrom } from '../anim/FlyFrom';
import { DraggableCard } from './DraggableCard';
import { layerOffset } from './layers';
import { STACK_CAP, zoneProps } from './zones';

export interface PileProps {
  player: PublicPlayer;
  /** Моя стопка: верхняя карта всегда интерактивный элемент (включён он или нет — флагом). */
  mine?: boolean;
  targetable: boolean;
  onTarget(): void;
  topDraggable: boolean;
  topSelected: boolean;
  onTopTap(): void;
  onTopDrop(target: string): void;
  accept: (id: string) => boolean;
}

/** Открытая стопка фазы 1: ровно stackCount карт (видна верхняя), высота и закрытый прикуп. */
export function Pile({ player, mine = false, targetable, onTarget, topDraggable, topSelected, onTopTap, onTopDrop, accept }: PileProps) {
  const top = player.stackTop;
  const topKey = top ? cardKey(top) : '';
  // Карта не появляется на стопке из ниоткуда: она прилетает оттуда, где лежала (спека §2c.1).
  const flight = useAppStore((s) => (topKey ? (s.flights.cards[topKey] ?? null) : null));
  const delay = useAppStore((s) => (topKey ? (s.flights.delays[topKey] ?? 0) : 0));
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
            <FlyFrom
              key={topKey}
              from={flight}
              delayMs={delay}
              // Раздача: карта летит из колоды рубашкой и переворачивается в полёте.
              ghost={flight === 'deck' ? <FlipIn flip><PlayingCard card={top} /></FlipIn> : <PlayingCard card={top} />}
            >
              {mine ? (
                <DraggableCard card={top} selected={topSelected} onTap={onTopTap} onDrop={onTopDrop} accept={accept} enter={!flight} enabled={topDraggable} carried />
              ) : (
                <AnimatedCard id={topKey} enter={!flight} carried>
                  <PlayingCard card={top} />
                </AnimatedCard>
              )}
            </FlyFrom>
          </div>
        )}
        <span className="count-badge pile__count">{player.stackCount}</span>
      </div>
    </div>
  );
}
