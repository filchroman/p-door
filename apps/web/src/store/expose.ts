import type { ClientUpdate } from '../client/types';
import { cardsInPlay, cardsShown, expectedZones, renderedZones } from '../ui/table/zones';

export interface ExposedView {
  gameNumber: number;
  status: string;
  phase: string;
  /** Чей сейчас ход. */
  turn: string;
  /** Типы событий последнего показанного среза: по ним видно, какой ход сейчас проигрывается. */
  events: string[];
  /** Сколько карт должно быть в каждой зоне по срезу — точное число, оно же стоит рядом цифрой. */
  zones: Record<string, number>;
  /** Сколько карт зона обязана нарисовать: то же число, но не больше предела показа (спека §2c.2). */
  rendered: Record<string, number>;
  /** Сколько карт всего в игре по срезу. */
  total: number;
  /** Сколько карт всего нарисовано с учётом пределов показа. */
  shown: number;
}

declare global {
  interface Window {
    __vakhta?: ExposedView;
  }
}

/**
 * Срез, по которому нарисован стол, — наружу в `window.__vakhta`: браузерная проверка «в покое»
 * (e2e) сверяет разметку со срезом, а не с тем, что разметка сама о себе объявила.
 * Ничего скрытого здесь нет — это ровно тот же PlayerView, по которому рисуются экраны.
 */
export function exposeView(update: ClientUpdate | null): void {
  if (typeof window === 'undefined') return;
  window.__vakhta = update
    ? {
        gameNumber: update.session.gameNumber,
        status: update.session.status,
        phase: update.view.phase,
        turn: update.view.turn,
        events: update.events.map((event) => event.type),
        zones: expectedZones(update.view),
        rendered: renderedZones(update.view),
        total: cardsInPlay(update.view),
        shown: cardsShown(update.view),
      }
    : undefined;
}
