import type { Card, PublicPlayer } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useViewportWidth } from '../useViewport';
import { fanOverlap, opponentFanWidth, smallCardWidth } from './fan';
import { Prykup } from './Prykup';
import { zoneProps } from './zones';

/** Рука соперника: ровно handCount рубашек (веер сжимается, число элементов не меняется) и цифра. */
export function OpponentHand({ player, cards }: { player: PublicPlayer; cards: Card[] | null }) {
  const cardWidth = smallCardWidth(useViewportWidth());
  const style = {
    '--card-w': `${cardWidth}px`,
    '--overlap': `${fanOverlap(player.handCount, cardWidth, opponentFanWidth(cardWidth))}px`,
  } as CSSProperties;
  return (
    <div className="opp-hand">
      <div className="opp-hand__fan" style={style} aria-label={ru.table.hand(player.handCount)} {...zoneProps(`hand-${player.id}`, player.handCount)}>
        {cards
          ? cards.map((card) => <PlayingCard key={cardKey(card)} card={card} />)
          : Array.from({ length: player.handCount }, (_, i) => <PlayingCard key={i} card={null} />)}
      </div>
      <span className="opp-hand__count">{player.handCount}</span>
      <Prykup owner={player.id} count={player.prykupCount} />
    </div>
  );
}
