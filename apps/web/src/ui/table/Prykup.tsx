import type { PlayerId } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { PRYKUP_FAN_RATIO, overlapFraction } from './fan';
import { PRYKUP_CAP, zoneProps } from './zones';

/** Закрытый прикуп (спека §2c.2): не больше PRYKUP_CAP рубашек с наложением и точная цифра. */
export function Prykup({ owner, count }: { owner: PlayerId; count: number }) {
  if (count === 0) return null;
  const shown = Math.min(count, PRYKUP_CAP);
  const style = { '--overlap': `calc(var(--card-w) * ${overlapFraction(shown, PRYKUP_FAN_RATIO)})` } as CSSProperties;
  return (
    <span className="prykup" aria-label={ru.table.prykup(count)}>
      <span className="prykup__fan" style={style} {...zoneProps(`prykup-${owner}`, count, shown)}>
        {Array.from({ length: shown }, (_, i) => (
          <PlayingCard key={i} card={null} />
        ))}
      </span>
      <span className="prykup__count">{count}</span>
    </span>
  );
}
