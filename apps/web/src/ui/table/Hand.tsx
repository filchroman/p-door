import { cardToString, parseCard } from '@vakhta/engine';
import { memo, useCallback, useMemo, type CSSProperties } from 'react';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore, type AppState } from '../../store/appStore';
import { AnimatedCard } from '../anim/AnimatedCard';
import { AnimatedGroup } from '../anim/AnimatedGroup';
import { FlipIn } from '../anim/FlipIn';
import { FlyFrom } from '../anim/FlyFrom';
import { STAGGER_MS } from '../anim/motion';
import type { HandFlight } from '../anim/flights';
import type { Origin } from '../anim/origins';
import { useViewportWidth } from '../useViewport';
import { bigCardWidth, fanAngle, handBudget, handFan } from './fan';
import { legalFromView } from './legal';
import { useDrag } from './useDrag';
import { zoneProps } from './zones';

/**
 * Больше — перестроение веера несёт контейнер одной трансформацией вместо N обмеров карт
 * (бюджет ~12 летящих карт, спека §2a). Сами перелёты (общий layoutId) остаются у карт всегда:
 * иначе в обычной партии — 3 игрока, 36 карт, ~10 карт на руке — карта не летела бы никуда.
 */
export const MAX_ANIMATED_HAND = 6;
const isTable = (id: string) => id === 'table';

/** Строковые ключи — стабильные значения селекторов: чужой ход их не меняет. */
export const handKeyOf = (s: AppState): string => s.update?.view.myHand.map(cardToString).join(' ') ?? '';
export const legalKeyOf = (s: AppState): string => (s.update ? legalFromView(s.update.view).playable.map(cardToString).join(' ') : '');
const myTurnOf = (s: AppState): boolean => s.update?.view.phase === 'phase2' && s.update.view.turn === s.update.view.me;
const meOf = (s: AppState): string => s.update?.view.me ?? '';
const flipOf = (s: AppState): boolean => !!s.update && s.marks.opened.includes(s.update.view.me);
/** Обычно null — ссылка стабильна, и чужой ход руку не перерисовывает (спека §2a). */
const handFlightOf = (s: AppState): HandFlight | null => s.flights.hand;

interface HandCardProps {
  code: string;
  legal: boolean;
  dim: boolean;
  angle: number;
  myTurn: boolean;
  flipIn: boolean;
  /** Откуда карта прилетела в руку: со стола («взял нижнюю») или из прикупа (спека §2c.1). */
  from: Origin | null;
  /** Каскад прикупа: карты вылетают по одной (спека §2c.3). */
  delayMs: number;
  /** Веер перестраивает контейнер: карта не обмеряет себя, но свой layoutId сохраняет. */
  carried: boolean;
  onPlay(code: string): void;
}

const HandCard = memo(function HandCard({ code, legal, dim, angle, myTurn, flipIn, from, delayMs, carried, onPlay }: HandCardProps) {
  const card = useMemo(() => parseCard(code), [code]);
  const drag = useDrag({
    onTap: () => {
      if (myTurn) onPlay(code);
    },
    onDrop: () => {
      if (myTurn) onPlay(code);
    },
    accept: isTable,
  });
  const classes = ['hand-card', legal ? 'is-legal' : '', dim ? 'is-dim' : ''].filter(Boolean).join(' ');
  return (
    <div className={classes} data-legal={legal} style={{ '--angle': `${angle}deg` } as CSSProperties} {...drag.handlers}>
      <FlyFrom from={from} delayMs={delayMs} ghost={<PlayingCard card={card} />}>
        <AnimatedCard id={code} carried={carried} enter={!flipIn && !from}>
          <FlipIn flip={flipIn}>
            <PlayingCard card={card} />
          </FlipIn>
        </AnimatedCard>
      </FlyFrom>
    </div>
  );
});

/** Своя рука веером: ровно handCount карт; допустимые приподняты и подсвечены, в свой ход остальные приглушены. */
export const Hand = memo(function Hand() {
  const handKey = useAppStore(handKeyOf);
  const legalKey = useAppStore(legalKeyOf);
  const myTurn = useAppStore(myTurnOf);
  const me = useAppStore(meOf);
  const flipIn = useAppStore(flipOf);
  const handFlight = useAppStore(handFlightOf);
  const send = useAppStore((s) => s.send);
  const onPlay = useCallback((code: string) => send({ type: 'play', card: parseCard(code) }), [send]);
  const codes = handKey ? handKey.split(' ') : [];
  const legal = new Set(legalKey ? legalKey.split(' ') : []);
  const big = codes.length > MAX_ANIMATED_HAND;
  const viewport = useViewportWidth();
  const cardWidth = bigCardWidth(viewport);
  // Сначала разворот и запас под поворот крайних карт, и только остаток бюджета — под сами карты:
  // иначе с 7 карт крайние вылезают за экран и страница получает прокрутку (спека §2c.1).
  const fan = handFan(codes.length, cardWidth, handBudget(viewport));
  const style = { '--card-w': `${cardWidth}px`, '--overlap': `${fan.overlap}px` } as CSSProperties;
  return (
    <AnimatedGroup
      animate={big}
      className="hand"
      aria-label={ru.table.myHand}
      style={style}
      data-animate={big ? 'group' : 'cards'}
      {...zoneProps(`hand-${me}`, codes.length)}
    >
      {codes.map((code, i) => (
        <HandCard
          key={code}
          code={code}
          legal={legal.has(code)}
          dim={myTurn && !legal.has(code)}
          angle={fanAngle(i, codes.length)}
          myTurn={myTurn}
          flipIn={flipIn}
          from={handFlight && handFlight.cards.includes(code) ? handFlight.from : null}
          delayMs={handFlight ? Math.max(0, handFlight.cards.indexOf(code)) * STAGGER_MS : 0}
          carried={big}
          onPlay={onPlay}
        />
      ))}
    </AnimatedGroup>
  );
});
