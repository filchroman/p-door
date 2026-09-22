import {
  autoAction,
  isPlusOne,
  legalMoves,
  type Action,
  type Card,
  type GameState,
  type PlayerId,
  type Suit,
} from '@vakhta/engine';

export const BOT_MISTAKE_CHANCE = 0.15;
export const BOT_SPOT_CHANCE = 0.5;
export const BOT_FALSE_CALL_CHANCE = 0.03;
export const BOT_REACTION_MIN_MS = 800;
export const BOT_REACTION_MAX_MS = 2500;

/** Самая дешёвая карта: некозырь раньше козыря, внутри — младший ранг. */
export function cheapest(cards: Card[], trump: Suit | null): Card | null {
  const sorted = [...cards].sort((a, b) => Number(a.suit === trump) - Number(b.suit === trump) || a.rank - b.rank);
  return sorted[0] ?? null;
}

/**
 * Нарушение вместо правильного хода фазы 1:
 * (а) тянуть, когда своя верхняя карта обязана уйти сопернику;
 * (б) оставить себе вытянутую карту, у которой есть цель «+1» у соперника.
 * «+1» на свою стопку — не нарушение, такую «ошибку» не делаем.
 */
export function phase1Mistake(state: GameState, playerId: PlayerId, correct: Action): Action | null {
  if (correct.type === 'moveOwnTop') return { type: 'draw' };
  if (correct.type !== 'placeDrawn' || correct.to === playerId || !state.drawn) return null;
  const stack = state.players.find((p) => p.id === playerId)?.stack ?? [];
  const ownTop = stack[stack.length - 1];
  if (ownTop && isPlusOne(state.drawn, ownTop, state.deckSize)) return null;
  return { type: 'placeDrawn', to: playerId };
}

function phase1(state: GameState, playerId: PlayerId, rng: () => number): Action | null {
  const correct = autoAction(state, playerId, rng);
  if (!correct) return null;
  const mistake = phase1Mistake(state, playerId, correct);
  return mistake && rng() < BOT_MISTAKE_CHANCE ? mistake : correct;
}

function penalty(state: GameState, playerId: PlayerId): Action | null {
  const debt = state.debts.find((d) => d.from === playerId && d.count > 0);
  const hand = state.players.find((p) => p.id === playerId)?.hand ?? [];
  const card = cheapest(hand, state.trump);
  return debt && card ? { type: 'givePenalty', to: debt.to, card } : null;
}

function phase2(state: GameState, playerId: PlayerId): Action | null {
  const legal = legalMoves(state, playerId);
  const card = cheapest(legal.playable, state.trump);
  if (card) return { type: 'play', card };
  return legal.canTake ? { type: 'take' } : null;
}

/** Ход бота, когда партия ждёт его действия. Решает только по открытой информации. */
export function botAction(state: GameState, playerId: PlayerId, rng: () => number): Action | null {
  switch (state.phase) {
    case 'phase1':
      return phase1(state, playerId, rng);
    case 'penalty':
      return penalty(state, playerId);
    case 'phase2':
      return phase2(state, playerId);
    default:
      return null;
  }
}

/**
 * Решение по одному окну Вахты: вызвать ли и через сколько мс.
 * Нарушение бот «замечает» с вероятностью 50 % (имитация внимательности — единственное место,
 * где бот пользуется скрытым знанием), без нарушения ложно вызывает с вероятностью 3 %.
 */
export function botVakhtaDelay(state: GameState, botId: PlayerId, watchId: number, rng: () => number): number | null {
  const watch = state.watches.find((w) => w.id === watchId);
  if (!watch || watch.playerId === botId || watch.called) return null;
  const chance = watch.violated ? BOT_SPOT_CHANCE : BOT_FALSE_CALL_CHANCE;
  if (rng() >= chance) return null;
  return BOT_REACTION_MIN_MS + rng() * (BOT_REACTION_MAX_MS - BOT_REACTION_MIN_MS);
}
