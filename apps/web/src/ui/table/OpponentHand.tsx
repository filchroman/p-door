import type { Card, PublicPlayer } from '@vakhta/engine';
import type { CSSProperties } from 'react';
import { cardKey } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { FlyFrom } from '../anim/FlyFrom';
import { STAGGER_MS } from '../anim/motion';
import { OPPONENT_FAN_RATIO, overlapFraction } from './fan';
import { FAN_CAP, zoneProps } from './zones';

/**
 * Рука соперника (спека §2c.2): компактный веер с наложением — не больше FAN_CAP рубашек — и
 * рядом точная цифра `handCount`. Раньше рисовались все N рубашек: при 30 картах веер расползался,
 * рамка соперника разрасталась, и стол растягивался по вертикали за нижний край экрана.
 */
export function OpponentHand({ player, cards }: { player: PublicPlayer; cards: Card[] | null }) {
  // Веер зажат в цифру: размеры рубашек приходят из `.opponents` (--card-mini) и зависят от числа соперников.
  const shown = Math.min(player.handCount, FAN_CAP);
  // Бот берёт карту — это видно: рубашка прилетает со стола (или из прикупа) в его руку (§2c.1).
  const flight = useAppStore((s) => s.flights.hands[player.id] ?? null);
  const arriving = flight ? Math.min(flight.count, shown) : 0;
  const firstArriving = shown - arriving;
  const flyFrom = (i: number) => (flight && i >= firstArriving ? flight.from : null);
  /**
   * Прилетевшая рубашка — новый элемент. Веер ограничен FAN_CAP, и при полной руке слот последней
   * рубашки уже занят: без свежего ключа React оставил бы старый элемент, а перелёт играет только
   * появление — бот «брал» карту, и ничего не летело.
   */
  const keyOf = (i: number) => (flight && i >= firstArriving ? `fly-${flight.seq}-${i}` : `back-${i}`);
  /** Прикуп открывается по одной карте: каждая следующая рубашка вылетает чуть позже (§2c.3). */
  const delayOf = (i: number) => (flight && i >= firstArriving ? (i - firstArriving) * STAGGER_MS : 0);
  const style = { '--overlap': `calc(var(--card-w) * ${overlapFraction(shown, OPPONENT_FAN_RATIO)})`, '--n': shown } as CSSProperties;
  /** Лёгкий веер: каждая следующая рубашка повёрнута чуть сильнее, как в руке (спека §2c.3). */
  const fanStyle = (i: number) => ({ '--k': i }) as CSSProperties;
  /** Показываем хвост руки: прилетевшие карты лежат сверху, их и видно. */
  const faces = cards ? cards.slice(Math.max(0, cards.length - shown)) : null;
  return (
    <div className="opp-hand">
      <div className="opp-hand__cards">
        <div
          className="opp-hand__fan"
          style={style}
          aria-label={ru.table.hand(player.handCount)}
          {...zoneProps(`hand-${player.id}`, player.handCount, shown)}
        >
          {faces
            ? faces.map((card, i) => (
                <FlyFrom key={cardKey(card)} from={flyFrom(i)} delayMs={delayOf(i)} style={fanStyle(i)} ghost={<PlayingCard card={card} />}>
                  <PlayingCard card={card} />
                </FlyFrom>
              ))
            : Array.from({ length: shown }, (_, i) => (
                <FlyFrom key={keyOf(i)} from={flyFrom(i)} delayMs={delayOf(i)} style={fanStyle(i)} ghost={<PlayingCard card={null} />}>
                  <PlayingCard card={null} />
                </FlyFrom>
              ))}
        </div>
        <span className="count-badge opp-hand__count">{player.handCount}</span>
      </div>
    </div>
  );
}
