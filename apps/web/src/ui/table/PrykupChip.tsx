import type { PlayerId } from '@vakhta/engine';
import { ru } from '../../i18n/ru';
import { zoneProps } from './zones';

/**
 * Прикуп — только цифрой (заказчик: «прикуп не надо отображать как карты»): чип на рамке аватарки.
 * Зона остаётся, чтобы число сверялось со срезом, но карт в ней не рисуется (PRYKUP_CAP = 0).
 */
export function PrykupChip({ owner, count }: { owner: PlayerId; count: number }) {
  if (count === 0) return null;
  return (
    <span className="prykup-chip" title={ru.table.prykup(count)} aria-label={ru.table.prykup(count)} {...zoneProps(`prykup-${owner}`, count, 0)}>
      {count}
    </span>
  );
}
