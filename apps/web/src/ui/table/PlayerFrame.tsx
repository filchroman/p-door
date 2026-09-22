import type { PublicPlayer } from '@vakhta/engine';
import type { ReactNode } from 'react';
import type { SeatInfo } from '../../client/types';
import { ru } from '../../i18n/ru';
import { Countdown } from '../Countdown';
import '../effects/effects.css';
import type { StatusKey } from './derive';

export interface PlayerFrameProps {
  seat: SeatInfo;
  player: PublicPlayer;
  status: StatusKey | null;
  turnEndsAt: number | null;
  turnTotalMs: number | null;
  /** seq свежего «Попался на Вахте», если этот игрок — нарушитель. */
  caughtSeq: number | null;
  /** seq свежего выхода из партии. */
  outSeq: number | null;
  /** Что этот игрок только что сделал: «вытянул», «переложил Гале» (спека §2c). */
  caption: string | null;
  /** Номер действия: тем же текстом подряд подпись всё равно появляется заново. */
  captionSeq: number | null;
  children?: ReactNode;
}

export function PlayerFrame({ seat, player, status, turnEndsAt, turnTotalMs, caughtSeq, outSeq, caption, captionSeq, children }: PlayerFrameProps) {
  const classes = ['player-frame', status === 'turn' ? 'is-turn' : '', caption ? 'is-acting' : '', player.out ? 'is-out' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} data-testid={`player-${seat.id}`}>
      <div className="plaque-slot">{status && <span className={`plaque plaque--${status}`}>{ru.status[status]}</span>}</div>
      <div className="avatar-frame">
        <div key={caughtSeq ?? 'calm'} className={caughtSeq !== null ? 'avatar-shake' : 'avatar-still'}>
          <span className="avatar" aria-hidden="true">{seat.avatar}</span>
        </div>
        {player.fouls > 0 && (
          <span className="foul-badge" title={ru.table.fouls(player.fouls)}>
            {player.fouls}
          </span>
        )}
        {caughtSeq !== null && (
          <>
            <span key={`stamp-${caughtSeq}`} className="fx-stamp" aria-hidden="true">{ru.fx.stamp}</span>
            <span key={`chip-${caughtSeq}`} className="fx-chip" aria-hidden="true">{ru.fx.foulChip}</span>
          </>
        )}
        {outSeq !== null && (
          <span key={`out-${outSeq}`} className="fx-out" aria-hidden="true">{ru.fx.outRibbon}</span>
        )}
        {turnEndsAt !== null && <Countdown endsAt={turnEndsAt} totalMs={turnTotalMs} className="avatar-timer" />}
      </div>
      <div className="player-name">{seat.name}</div>
      {/* Подпись лежит поверх рамки: появляется и гаснет, ничего не сдвигая. */}
      {caption && (
        <span key={captionSeq ?? caption} className="act-caption" data-testid={`caption-${seat.id}`}>
          {caption}
        </span>
      )}
      {children && <div className="player-extras">{children}</div>}
    </div>
  );
}
