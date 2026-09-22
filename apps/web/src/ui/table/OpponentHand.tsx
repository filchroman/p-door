import type { Card, PublicPlayer } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { FAN_WIDTH_OPPONENT, fanOverlap } from './fan';
import { Prykup } from './Prykup';
import { zoneProps } from './zones';

const OPPONENT_CARD = 26;

/** Рука соперника: ровно handCount рубашек (веер сжимается, число элементов не меняется) и цифра. */
export function OpponentHand({ player, cards }: { player: PublicPlayer; cards: Card[] | null }) {
  const style = { '--overlap': `${fanOverlap(player.handCount, OPPONENT_CARD, FAN_WIDTH_OPPONENT)}px` } as CSSProperties;
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
