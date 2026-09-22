import { sameCard, type Card } from '@vakhta/engine';
import { memo } from 'react';
import { BACK_URL, faceUrl } from './art';
import './cards.css';
import { cardLabel } from './labels';

export interface PlayingCardProps {
  card: Card | null;
  faceDown?: boolean;
  /** Бумажная заглушка без картинки: карты под верхней в открытой стопке. */
  blank?: boolean;
  className?: string;
}

/** Размер растра — атрибуты width/height берегут от сдвигов вёрстки; на экране размер задаёт --card-w. */
const ART_WIDTH = 240;
const ART_HEIGHT = 360;

function PlayingCardView({ card, faceDown = false, blank = false, className = '' }: PlayingCardProps) {
  if (blank) {
    return (
      <div className={`card card--blank ${className}`.trim()}>
        <span className="card__img" />
      </div>
    );
  }
  const face = card && !faceDown ? card : null;
  return (
    <div className={`card ${className}`.trim()}>
      <img
        className="card__img"
        src={face ? faceUrl(face) : BACK_URL}
        alt={face ? cardLabel(face) : ''}
        decoding="async"
        draggable={false}
        width={ART_WIDTH}
        height={ART_HEIGHT}
      />
    </div>
  );
}

export function samePlayingCardProps(a: PlayingCardProps, b: PlayingCardProps): boolean {
  if ((a.faceDown ?? false) !== (b.faceDown ?? false) || (a.blank ?? false) !== (b.blank ?? false)) return false;
  if ((a.className ?? '') !== (b.className ?? '')) return false;
  if (a.card === null || b.card === null) return a.card === b.card;
  return sameCard(a.card, b.card);
}

export const PlayingCard = memo(PlayingCardView, samePlayingCardProps);
