import type { TableCard } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { AnimatedCard } from '../anim/AnimatedCard';
import { ExitGroup } from '../anim/ExitGroup';
import { zoneProps } from './zones';

/** Стол фазы 2: веер снизу вверх, нижняя и верхняя карты выделены; сюда можно бросить карту. */
export function TableFan({ table }: { table: TableCard[] }) {
  return (
    <div className="table-fan" data-drop="table" aria-label={ru.table.tableZone} {...zoneProps('table', table.length)}>
      <ExitGroup>
        {table.map((t, i) => {
          const classes = ['table-card', i === 0 ? 'is-bottom' : '', i === table.length - 1 ? 'is-top' : ''].filter(Boolean).join(' ');
          return (
            <AnimatedCard key={cardKey(t.card)} id={cardKey(t.card)} className={classes} style={{ '--i': i } as CSSProperties} exit>
              <PlayingCard card={t.card} />
            </AnimatedCard>
          );
        })}
      </ExitGroup>
    </div>
  );
}
