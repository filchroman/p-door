import type { Card, TableCard } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { AnimatedCard } from '../anim/AnimatedCard';
import { ExitGroup } from '../anim/ExitGroup';
import { zoneProps } from './zones';

/** Стол фазы 2: веер снизу вверх, нижняя и верхняя карты выделены; сюда можно бросить карту. */
export function TableFan({ table }: { table: TableCard[] }) {
  return (
    <div className="table-fan" data-drop="table" aria-label={ru.table.tableZone} {...zoneProps('table', table.length)}>
      <ExitGroup>
        {table.map((t, i) => (
          <TableFanCard
            key={cardKey(t.card)}
            card={t.card}
            className={['table-card', i === 0 ? 'is-bottom' : '', i === table.length - 1 ? 'is-top' : ''].filter(Boolean).join(' ')}
            index={i}
          />
        ))}
      </ExitGroup>
    </div>
  );
}

/**
 * Улетать карте или нет, решается здесь, а не пропом сверху: AnimatePresence доигрывает уходящую
 * карту тем элементом, каким она была в последнем кадре на столе, — проп бы застрял на прошлом срезе,
 * а подписка на стор обновляется и у уходящей карты. Отбой — карты улетают; взятая нижняя переезжает
 * в руку одним элементом по общему layoutId, поэтому exit ей не даём (иначе она играет в двух местах).
 */
function TableFanCard({ card, className, index }: { card: Card; className: string; index: number }) {
  const sweep = useAppStore((s) => s.tableSweep);
  return (
    <AnimatedCard id={cardKey(card)} className={className} style={{ '--i': index } as CSSProperties} exit={sweep}>
      <PlayingCard card={card} />
    </AnimatedCard>
  );
}
