import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { layerOffset } from './layers';

/** Сколько рубашек рисует стопка отбоя: дальше слои всё равно не видно, а число стоит цифрой. */
export const DISCARD_CAP = 6;

/**
 * Отбой — стопка рубашек у правого края стола (заказчик: «отбой давай тоже справа»), к ней и
 * улетают сметённые карты. Это не зона среза: карт в игре она не считает, поэтому `data-zone` нет.
 */
export function DiscardPile({ count }: { count: number }) {
  if (count === 0) return null;
  const shown = Math.min(count, DISCARD_CAP);
  return (
    <div className="discard-pile" data-testid="discard-pile" aria-label={ru.table.discard(count)}>
      <div className="discard-pile__stack">
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className="stack-layer" style={layerOffset(i)}>
            <PlayingCard card={null} />
          </span>
        ))}
      </div>
      <span className="count-badge discard-pile__count">{count}</span>
    </div>
  );
}
