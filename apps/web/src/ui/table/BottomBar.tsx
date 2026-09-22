import type { Card, PublicPlayer, Suit } from '@vakhta/engine';
import type { ReactNode } from 'react';
import type { SeatInfo } from '../../client/types';
import type { StatusKey } from './derive';
import { PlayerFrame } from './PlayerFrame';
import { TrumpBadge } from './TrumpBadge';

export interface BottomBarProps {
  action: ReactNode;
  seat: SeatInfo;
  player: PublicPlayer;
  status: StatusKey | null;
  turnEndsAt: number | null;
  turnTotalMs: number | null;
  caughtSeq: number | null;
  outSeq: number | null;
  caption: string | null;
  captionSeq: number | null;
  trump: Suit | null;
  trumpCard: Card | null;
  counter: string | null;
}

/** Светлая «пластиковая» плашка: действие слева, своя аватарка по центру, козырь и счётчик справа. */
export function BottomBar({ action, trump, trumpCard, counter, ...me }: BottomBarProps) {
  return (
    <div className="bottom-bar plastic" onClick={(e) => e.stopPropagation()}>
      <div className="bottom-bar__action">{action}</div>
      <div className="bottom-bar__me">
        <PlayerFrame {...me} />
      </div>
      <div className="bottom-bar__info">
        {trump && <TrumpBadge suit={trump} card={trumpCard} />}
        {counter && <span className="vidbiy-counter">{counter}</span>}
      </div>
    </div>
  );
}
