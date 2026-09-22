import type { GameState, PlayerId, Watch } from './types';

export const VAKHTA_GRACE_MS = 3000;

export function isWatchOpen(w: Watch, now: number): boolean {
  return !w.called && (!w.othersActed || now - w.at < VAKHTA_GRACE_MS);
}

export function openWatch(s: GameState, playerId: PlayerId, now: number, violated: boolean): void {
  s.watches.push({ id: s.nextWatchId++, playerId, at: now, violated, called: false, othersActed: false });
}

export function markOthersActed(s: GameState, actorId: PlayerId): void {
  for (const w of s.watches) if (w.playerId !== actorId) w.othersActed = true;
}

/** Каждый не вышедший соперник нарушителя должен отдать ему `count` карт. */
export function addFoulDebts(s: GameState, offenderId: PlayerId, count: number): void {
  for (const p of s.players) {
    if (p.id === offenderId || p.out) continue;
    const debt = s.debts.find((d) => d.from === p.id && d.to === offenderId);
    if (debt) debt.count += count;
    else s.debts.push({ from: p.id, to: offenderId, count });
  }
}
