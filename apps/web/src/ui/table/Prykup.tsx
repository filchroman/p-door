import type { PlayerId } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useViewportWidth } from '../useViewport';
import { fanOverlap, prykupFanWidth, smallCardWidth } from './fan';
import { zoneProps } from './zones';

/** Закрытый прикуп: ровно count рубашек (веер сжимается) и цифра. */
export function Prykup({ owner, count }: { owner: PlayerId; count: number }) {
  const cardWidth = smallCardWidth(useViewportWidth());
  if (count === 0) return null;
  const style = {
    '--card-w': `${cardWidth}px`,
    '--overlap': `${fanOverlap(count, cardWidth, prykupFanWidth(cardWidth))}px`,
  } as CSSProperties;
  return (
    <span className="prykup" aria-label={ru.table.prykup(count)}>
      <span className="prykup__fan" style={style} {...zoneProps(`prykup-${owner}`, count)}>
        {Array.from({ length: count }, (_, i) => (
          <PlayingCard key={i} card={null} />
        ))}
      </span>
      <span className="prykup__count">{count}</span>
    </span>
  );
}
