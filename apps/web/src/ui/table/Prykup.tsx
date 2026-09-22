import type { PlayerId } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { fanOverlap } from './fan';
import { zoneProps } from './zones';

const PRYKUP_CARD = 22;
const PRYKUP_WIDTH = 56;

/** Закрытый прикуп: ровно count рубашек (веер сжимается) и цифра. */
export function Prykup({ owner, count }: { owner: PlayerId; count: number }) {
  if (count === 0) return null;
  const style = { '--overlap': `${fanOverlap(count, PRYKUP_CARD, PRYKUP_WIDTH)}px` } as CSSProperties;
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
