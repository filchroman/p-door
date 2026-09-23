import type { TableCard } from '@vakhta/engine';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
            ghost={<PlayingCard card={t.card} />}
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

/** Куда улетает отбой, если стопки отбоя на экране ещё нет: вправо и чуть вверх, за край колонки. */
const FALLBACK_SWEEP = { x: 104, y: -22, s: 1 };

/**
 * Отбой (спека §2c.3): сначала закрывающая карта долетает из руки и ложится на стол
 * (`sweep.landing`), стол стоит; потом, когда стор снимает `landing`, весь стол улетает в стопку
 * отбоя справа. Слой живёт ровно свою анимацию и снимается стором — в зоне стола ничего не остаётся.
 * Карты только на transform и opacity (§2a).
 */
function SweptTable({ sweep }: { sweep: TableSweep }) {
  const ref = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState(FALLBACK_SWEEP);
  // Куда лететь — к стопке отбоя: одна пара обмеров на весь отбой, а не на кадр.
  useLayoutEffect(() => {
    const me = ref.current;
    const pile = document.querySelector<HTMLElement>('.discard-pile__stack');
    if (!me || !pile) return;
    const a = me.getBoundingClientRect();
    const b = pile.getBoundingClientRect();
    if (a.width === 0 || b.width === 0) return;
    setTarget({
      x: Math.round(b.left + b.width / 2 - (a.left + a.width / 2)),
      y: Math.round(b.top + b.height / 2 - (a.top + a.height / 2)),
      s: Math.max(0.3, b.width / Math.max(1, a.width)),
    });
  }, []);
  const landing = sweep.landing;
  const style = {
    '--sweep-ms': `${sweep.ms}ms`,
    '--sweep-x': `${target.x}px`,
    '--sweep-y': `${target.y}px`,
    '--sweep-s': target.s,
  } as CSSProperties;
  return (
    <div ref={ref} className={`table-sweep${sweep.waiting ? ' is-landing' : ''}`} aria-hidden style={style}>
      {sweep.cards.map((card, i) => (
        <FlyFrom
          key={cardKey(card)}
          from={landing && cardKey(card) === landing.key ? landing.from : null}
          ghost={<PlayingCard card={card} />}
          className={fanClass(i, sweep.cards.length)}
          style={{ '--i': i } as CSSProperties}
        >
          <PlayingCard card={card} />
        </FlyFrom>
      ))}
    </div>
  );
}
