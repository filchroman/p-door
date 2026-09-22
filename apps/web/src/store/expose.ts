import type { ClientUpdate } from '../client/types';
import { cardsInPlay, expectedZones } from '../ui/table/zones';

export interface ExposedView {
  gameNumber: number;
  status: string;
  phase: string;
  /** Сколько карт должно быть в каждой зоне по срезу. */
  zones: Record<string, number>;
  /** Сколько карт всего в игре по срезу. */
  total: number;
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
        zones: expectedZones(update.view),
        total: cardsInPlay(update.view),
      }
    : undefined;
}
