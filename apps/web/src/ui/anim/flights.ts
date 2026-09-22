import { cardToString, type PlayerId } from '@vakhta/engine';
import type { ClientUpdate } from '../../client/types';
import { cardOrigin, zoneOrigin, type Origin } from './origins';

/** Прилетевшие в руку карты: своя рука знает их ключи, чужая — только число рубашек. */
export interface HandFlight {
  from: Origin;
  /** Ключи прилетевших карт (своя рука) — по ним карта находит свой перелёт. */
  cards: string[];
  /** Сколько рубашек прилетело (чужая рука). */
  count: number;
}

/**
 * Откуда какая карта прилетела в этом срезе (спека §2c.1 «Каждый тип хода имеет видимую анимацию»).
 *
 * Точки снимаются с ещё не перерисованного экрана — прямо перед тем, как стор отдаст новый срез:
 * карта, которая вот-вот переедет в другую зону, сейчас ещё лежит в старой, и её место на экране —
 * это и есть начало перелёта. Приёмник получает точку и проигрывает перелёт сам (`FlyFrom`).
 */
export interface Flights {
  /** Ключ карты → откуда лететь: открытые приёмники (стопки и стол). */
  cards: Record<string, Origin>;
  /** Закрытые руки соперников: рубашка летит оттуда, откуда ушла карта. */
  hands: Record<PlayerId, HandFlight>;
  /** Моя рука: прилетевшие карты и их общая точка старта. */
  hand: HandFlight | null;
}

export const NO_FLIGHTS: Flights = { cards: {}, hands: {}, hand: null };

const originOf = (key: string, ...zones: string[]): Origin | null =>
  cardOrigin(key) ?? zones.reduce<Origin | null>((found, zone) => found ?? zoneOrigin(zone), null);

const countIn = (update: ClientUpdate | null, id: PlayerId, what: 'handCount' | 'prykupCount'): number =>
  update?.view.players.find((p) => p.id === id)?.[what] ?? 0;

/** Карты, которых в моей руке не было, а в новом срезе есть. */
function newInMyHand(prev: ClientUpdate | null, update: ClientUpdate): string[] {
  const before = new Set((prev?.view.myHand ?? []).map(cardToString));
  return update.view.myHand.map(cardToString).filter((key) => !before.has(key));
}

export function flightsFor(prev: ClientUpdate | null, update: ClientUpdate): Flights {
  const cards: Flights['cards'] = {};
  const hands: Flights['hands'] = {};
  const me = update.view.me;
  let hand: HandFlight | null = null;

  for (const event of update.events) {
    switch (event.type) {
      // Вытянутая карта летит из колоды — этот перелёт играет сама колода (DeckArea).
      case 'placed':
      case 'kept': {
        // Из слота вытянутой на стопку: свою («оставил себе», «+1») или чужую («переложил Гале»).
        const key = cardToString(event.card);
        const from = originOf(key, 'drawn');
        if (from) cards[key] = from;
        break;
      }
      case 'movedTop': {
        // Своя верхняя карта уезжает на чужую стопку — то самое «не видно, как передаётся».
        const key = cardToString(event.card);
        const from = originOf(key, `stack-${event.from}`);
        if (from) cards[key] = from;
        break;
      }
      case 'played': {
        // Рука → стол. Своя карта летит со своего места в веере, чужая — от руки соперника.
        const key = cardToString(event.card);
        const from = event.playerId === me ? originOf(key, `hand-${me}`) : zoneOrigin(`hand-${event.playerId}`);
        if (from) cards[key] = from;
        break;
      }
      case 'tookBottom': {
        // Стол → рука. Своя карта летит открытой, чужая — рубашкой, но обе летят.
        const from = originOf(cardToString(event.card), 'table');
        if (!from) break;
        if (event.playerId === me) hand = { from, cards: [cardToString(event.card)], count: 1 };
        else hands[event.playerId] = { from, cards: [], count: 1 };
        break;
      }
      case 'prykupOpened': {
        const from = zoneOrigin(`prykup-${event.playerId}`);
        if (!from) break;
        if (event.playerId === me) {
          const keys = newInMyHand(prev, update);
          if (keys.length > 0) hand = { from, cards: keys, count: keys.length };
        } else {
          const opened = Math.max(
            countIn(prev, event.playerId, 'prykupCount') - countIn(update, event.playerId, 'prykupCount'),
            countIn(update, event.playerId, 'handCount') - countIn(prev, event.playerId, 'handCount'),
          );
          if (opened > 0) hands[event.playerId] = { from, cards: [], count: opened };
        }
        break;
      }
    }
  }
  return { cards, hands, hand };
}
