import type { PlayerId } from '@vakhta/engine';
import type { SeatInfo } from '../../client/types';
import { ru } from '../../i18n/ru';
import { Avatar } from '../Avatar';

export function LossTable({ players, losses, highlight }: { players: SeatInfo[]; losses: Record<PlayerId, number>; highlight: PlayerId | null }) {
  const rows = [...players].sort((a, b) => (losses[b.id] ?? 0) - (losses[a.id] ?? 0));
  return (
    <table className="loss-table">
      <caption>{ru.results.losses}</caption>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className={p.id === highlight ? 'is-highlight' : undefined}>
            <td><Avatar value={p.avatar} className="loss-table__avatar" /></td>
            <td>{p.name}</td>
            <td className="num">{losses[p.id] ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
