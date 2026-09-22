import type { PlayerId, PlayerView, PublicPlayer } from '@vakhta/engine';
import type { ru } from '../../i18n/ru';
import type { RecentMarks } from '../../store/derive';

export type StatusKey = keyof typeof ru.status;

/** Соперники по часовой стрелке, начиная со следующего после меня. */
export function opponentsOf(view: PlayerView): PublicPlayer[] {
  const i = view.players.findIndex((p) => p.id === view.me);
  return [...view.players.slice(i + 1), ...view.players.slice(0, i)];
}

export function activeCount(view: PlayerView): number {
  return view.players.filter((p) => !p.out).length;
}

export function playerStatus(view: PlayerView, id: PlayerId, marks: RecentMarks): StatusKey | null {
  const player = view.players.find((p) => p.id === id);
  if (!player) return null;
  if (player.out) return 'out';
  if (marks.vakhtaBy === id) return marks.vakhtaCaught ? 'caught' : 'vakhta';
  if ((view.phase === 'phase1' || view.phase === 'phase2') && view.turn === id) return 'turn';
  if (view.phase === 'phase2' && player.handCount === 0) return 'waiting';
  const act = marks.acts[id];
  if (act === 'took') return 'taking';
  if (act === 'beat') return 'beating';
  return null;
}
