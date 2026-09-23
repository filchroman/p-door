import type { PlayerId, PublicPlayer } from '@vakhta/engine';
import type { CSSProperties, ReactNode } from 'react';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { isFresh } from '../../store/derive';
import { useViewportWidth } from '../useViewport';
import { BottomBar } from './BottomBar';
import { DiscardPile } from './DiscardPile';
import { activeCount, opponentsOf, playerStatus } from './derive';
import { miniCardWidth, opponentAvatar, opponentCardWidth } from './fan';
import { PlayerFrame } from './PlayerFrame';
import { seatArcY } from './seats';
import { cardsInPlay, cardsShown } from './zones';
import './table.css';

export interface TableScreenProps {
  center: ReactNode;
  mine: ReactNode;
  action: ReactNode;
  opponentExtras?: (player: PublicPlayer) => ReactNode;
}

export function TableScreen({ center, mine, action, opponentExtras }: TableScreenProps) {
  const update = useAppStore((s) => s.update)!;
  const marks = useAppStore((s) => s.marks);
  const hasSelection = useAppStore((s) => s.selection !== null);
  const select = useAppStore((s) => s.select);
  const acting = useAppStore((s) => s.acting);
  const { view, players, deadlines } = update;
  const now = Date.now();
  const seatOf = (id: PlayerId) => players.find((p) => p.id === id)!;
  const me = view.players.find((p) => p.id === view.me)!;
  const turnEndsAt = (id: PlayerId) => (view.turn === id ? deadlines.turnEndsAt : null);
  const caughtSeq = (id: PlayerId) =>
    marks.caught && isFresh(marks.caught, now) && marks.caught.offenders.includes(id) ? marks.caught.seq : null;
  const outSeq = (id: PlayerId) => (isFresh(marks.outFx[id], now) ? marks.outFx[id].seq : null);
  const frame = (p: PublicPlayer) => ({
    seat: seatOf(p.id),
    player: p,
    status: playerStatus(view, p.id, marks),
    turnEndsAt: turnEndsAt(p.id),
    turnTotalMs: deadlines.turnTotalMs,
    caughtSeq: caughtSeq(p.id),
    outSeq: outSeq(p.id),
    caption: acting?.id === p.id ? acting.text : null,
    captionSeq: acting?.id === p.id ? acting.seq : null,
    captionMs: acting?.id === p.id ? acting.holdMs : null,
  });
  // Чем больше соперников, тем компактнее их строка: при пяти иначе экран растягивается за 812 px
  // и получает вертикальную прокрутку, которой §2c.2 не допускает.
  const opponents = opponentsOf(view);
  const viewport = useViewportWidth();
  const opponentSizes = {
    '--card-small': `${opponentCardWidth(opponents.length, viewport)}px`,
    '--card-mini': `${miniCardWidth(opponents.length, viewport)}px`,
    '--avatar-size': `${opponentAvatar(opponents.length)}px`,
  } as CSSProperties;
  return (
    <div className="table-screen" data-total={cardsInPlay(view)} data-shown={cardsShown(view)} onClick={() => hasSelection && select(null)}>
      <div className="opponents" style={opponentSizes}>
        {opponents.map((p, i) => (
          // Одна дуга на всех: крайние места чуть ниже, центр выше (спека §2c.3).
          <PlayerFrame key={p.id} {...frame(p)} style={{ '--arc-y': `${seatArcY(i, opponents.length)}px` } as CSSProperties}>
            {opponentExtras?.(p)}
          </PlayerFrame>
        ))}
      </div>
      <div className="table-center">
        {center}
        <DiscardPile count={view.discardCount} />
      </div>
      <div className="my-area">{mine}</div>
      <BottomBar
        action={action}
        {...frame(me)}
        trump={view.trump}
        trumpCard={view.trumpCard}
        counter={view.phase === 'phase2' ? ru.table.toVidbiy(view.table.length, activeCount(view)) : null}
      />
    </div>
  );
}
