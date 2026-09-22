import type { GameState, PlayerId } from './types';
import { VAKHTA_GRACE_MS } from './vakhta';

/** Когда серверу прислать `tick`: ближайшее закрытие окна Вахты по времени, иначе null. */
export function nextDeadline(s: GameState): number | null {
  if (s.phase !== 'phase1' && s.phase !== 'penalty') return null;
  const ends = s.watches.filter((w) => !w.called && w.othersActed).map((w) => w.at + VAKHTA_GRACE_MS);
  return ends.length > 0 ? Math.min(...ends) : null;
}

/** Чьего действия ждёт партия: ходящий в фазах 1 и 2, должники (по местам) в штрафе. */
export function pendingPlayers(s: GameState): PlayerId[] {
  switch (s.phase) {
    case 'phase1':
    case 'phase2':
      return [s.turn];
    case 'penalty':
      return s.players.filter((p) => s.debts.some((d) => d.from === p.id && d.count > 0)).map((p) => p.id);
    case 'over':
      return [];
  }
}
