import type { Card, Suit } from '@vakhta/engine';
import { faceUrl } from '../../cards/art';
import { isRed, suitSymbol } from '../../cards/labels';
import { ru } from '../../i18n/ru';
import { FlipIn } from '../anim/FlipIn';

/** Значок козыря; перевёрнутая последняя карта — декоративная картинка (не .card: в зоны не входит). */
export function TrumpBadge({ suit, card }: { suit: Suit; card: Card | null }) {
  return (
    <div className="trump-badge" role="img" aria-label={ru.table.trump(suit)}>
      {card && (
        <FlipIn flip>
          <img className="trump-badge__card" src={faceUrl(card)} alt="" decoding="async" width={240} height={360} />
        </FlipIn>
      )}
      <span className={`trump-badge__suit${isRed(suit) ? ' is-red' : ''}`} aria-hidden="true">
        {suitSymbol(suit)}
      </span>
    </div>
  );
}
