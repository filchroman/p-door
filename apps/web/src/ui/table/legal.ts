import { canBeat, type LegalMoves, type PlayerView } from '@vakhta/engine';

/** Подсветка ходов фазы 2 по срезу игрока: те же правила боя, что в движке. */
export function legalFromView(view: PlayerView): LegalMoves {
  if (view.phase !== 'phase2' || view.turn !== view.me || !view.trump) return { playable: [], canTake: false };
  const top = view.table[view.table.length - 1];
  const trump = view.trump;
  const playable = top ? view.myHand.filter((card) => canBeat(card, top.card, trump, view.deckSize)) : [...view.myHand];
  return { playable, canTake: view.table.length > 0 };
}
