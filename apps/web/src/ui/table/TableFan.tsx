import type { TableCard } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore, type TableSweep } from '../../store/appStore';
import { AnimatedCard } from '../anim/AnimatedCard';
import { FlyFrom } from '../anim/FlyFrom';
import { zoneProps } from './zones';

/** Класс карты по месту в веере: нижнюю можно взять, верхнюю — бить. */
function fanClass(index: number, total: number): string {
  return ['table-card', index === 0 ? 'is-bottom' : '', index === total - 1 ? 'is-top' : ''].filter(Boolean).join(' ');
}

/**
 * Стол фазы 2: веер снизу вверх, нижняя и верхняя карты выделены; сюда можно бросить карту.
 * В зоне всегда ровно карты среза: взятая нижняя переезжает в руку одним элементом по общему
 * layoutId, а отбой улетает отдельным слоем поверх — карте незачем доигрывать уход внутри зоны.
 */
export function TableFan({ table }: { table: TableCard[] }) {
  const sweep = useAppStore((s) => s.sweep);
  const flights = useAppStore((s) => s.flights.cards);
  return (
    <div className="table-stage">
      <div className="table-fan" data-drop="table" aria-label={ru.table.tableZone} {...zoneProps('table', table.length)}>
        {table.map((t, i) => (
          // Обёртка перелёта — она же место карты в веере: карта прилетает из руки бьющего.
          <FlyFrom
            key={cardKey(t.card)}
            from={flights[cardKey(t.card)] ?? null}
            className={fanClass(i, table.length)}
            style={{ '--i': i } as CSSProperties}
          >
            <AnimatedCard id={cardKey(t.card)} enter={!flights[cardKey(t.card)]}>
              <PlayingCard card={t.card} />
            </AnimatedCard>
          </FlyFrom>
        ))}
      </div>
      {sweep && <SweptTable key={sweep.seq} sweep={sweep} />}
    </div>
  );
}

/**
 * Отбой: ушедший стол улетает отдельным слоем — карты только на transform и opacity, слой живёт
 * ровно свою анимацию и снимается стором, поэтому после отбоя на столе не остаётся ничего.
 */
function SweptTable({ sweep }: { sweep: TableSweep }) {
  return (
    <div className="table-sweep" aria-hidden style={{ '--sweep-ms': `${sweep.ms}ms` } as CSSProperties}>
      {sweep.cards.map((card, i) => (
        <div key={cardKey(card)} className={fanClass(i, sweep.cards.length)} style={{ '--i': i } as CSSProperties}>
          <PlayingCard card={card} />
        </div>
      ))}
    </div>
  );
}
