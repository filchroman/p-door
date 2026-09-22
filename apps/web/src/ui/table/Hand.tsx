import { cardToString, parseCard } from '@vakhta/engine';
import { memo, useCallback, useMemo, type CSSProperties } from 'react';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore, type AppState } from '../../store/appStore';
import { AnimatedCard } from '../anim/AnimatedCard';
import { AnimatedGroup } from '../anim/AnimatedGroup';
import { FlipIn } from '../anim/FlipIn';
import { fanOverlap } from './fan';
import { legalFromView } from './legal';
import { useDrag } from './useDrag';
import { zoneProps } from './zones';

/** Больше — веер двигается целиком одной трансформацией (не больше ~12 летящих карт, спека §2a). */
export const MAX_ANIMATED_HAND = 6;
const HAND_CARD = 68;
const HAND_WIDTH = 300;
const isTable = (id: string) => id === 'table';

/** Строковые ключи — стабильные значения селекторов: чужой ход их не меняет. */
export const handKeyOf = (s: AppState): string => s.update?.view.myHand.map(cardToString).join(' ') ?? '';
export const legalKeyOf = (s: AppState): string => (s.update ? legalFromView(s.update.view).playable.map(cardToString).join(' ') : '');
const myTurnOf = (s: AppState): boolean => s.update?.view.phase === 'phase2' && s.update.view.turn === s.update.view.me;
const meOf = (s: AppState): string => s.update?.view.me ?? '';
const flipOf = (s: AppState): boolean => !!s.update && s.marks.opened.includes(s.update.view.me);

interface HandCardProps {
  code: string;
  legal: boolean;
  dim: boolean;
  angle: number;
  myTurn: boolean;
  flipIn: boolean;
  still: boolean;
  onPlay(code: string): void;
}

const HandCard = memo(function HandCard({ code, legal, dim, angle, myTurn, flipIn, still, onPlay }: HandCardProps) {
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
      <AnimatedCard id={code} still={still}>
        <FlipIn flip={flipIn}>
          <PlayingCard card={card} />
        </FlipIn>
      </AnimatedCard>
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
  const send = useAppStore((s) => s.send);
  const onPlay = useCallback((code: string) => send({ type: 'play', card: parseCard(code) }), [send]);
  const codes = handKey ? handKey.split(' ') : [];
  const legal = new Set(legalKey ? legalKey.split(' ') : []);
  const big = codes.length > MAX_ANIMATED_HAND;
  const spread = Math.min(8, 60 / Math.max(codes.length, 1));
  const style = { '--overlap': `${fanOverlap(codes.length, HAND_CARD, HAND_WIDTH)}px` } as CSSProperties;
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
          angle={(i - (codes.length - 1) / 2) * spread}
          myTurn={myTurn}
          flipIn={flipIn}
          still={big}
          onPlay={onPlay}
        />
      ))}
    </AnimatedGroup>
  );
});
