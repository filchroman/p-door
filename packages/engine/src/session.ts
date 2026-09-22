import type { DeckSize } from './cards';
import { mulberry32 } from './rng';
import type { GameSetup } from './setup';
import type { GameResult, PlayerId } from './types';

export interface SessionState {
  losses: Record<PlayerId, number>;
  lossLog: PlayerId[]; // проигравшие по порядку партий (ничьи не пишутся)
  lastWinnerId: PlayerId | null;
}

export function newSession(): SessionState {
  return { losses: {}, lossLog: [], lastWinnerId: null };
}

export function prykupSize(se: SessionState, id: PlayerId): number {
  return 2 + (se.losses[id] ?? 0);
}

export function recordResult(se: SessionState, result: GameResult): SessionState {
  const losses = { ...se.losses };
  const lossLog = [...se.lossLog];
  if (result.loserId) {
    losses[result.loserId] = (losses[result.loserId] ?? 0) + 1;
    lossLog.push(result.loserId);
  }
  return { losses, lossLog, lastWinnerId: result.winnerId };
}

export function nextDealer(se: SessionState, playerIds: PlayerId[], random: () => number): PlayerId {
  const lastLoser = se.lossLog[se.lossLog.length - 1];
  if (lastLoser && playerIds.includes(lastLoser)) return lastLoser;
  return playerIds[Math.floor(random() * playerIds.length)];
}

export function vakhterVechora(se: SessionState): PlayerId | null {
  const ids = Object.keys(se.losses);
  if (ids.length === 0) return null;
  const max = Math.max(...ids.map((id) => se.losses[id]));
  const tied = new Set(ids.filter((id) => se.losses[id] === max));
  for (let i = se.lossLog.length - 1; i >= 0; i--) if (tied.has(se.lossLog[i])) return se.lossLog[i];
  return null;
}

export function setupNextGame(se: SessionState, playerIds: PlayerId[], deckSize: DeckSize, seed: number): GameSetup {
  const random = mulberry32(seed ^ 0x9e3779b9);
  return {
    deckSize,
    playerIds,
    prykupSizes: Object.fromEntries(playerIds.map((id) => [id, prykupSize(se, id)])),
    dealerId: nextDealer(se, playerIds, random),
    previousWinnerId: se.lastWinnerId && playerIds.includes(se.lastWinnerId) ? se.lastWinnerId : null,
    seed,
  };
}
