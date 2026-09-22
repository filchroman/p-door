import type { Card, ErrorCode, PlayerId, PlayerView } from '@vakhta/engine';
import type { ClientUpdate } from '../client/types';
import { ru } from '../i18n/ru';

export type Selection = { kind: 'drawn' } | { kind: 'ownTop' } | null;
export type ToastTone = 'info' | 'error' | 'vakhta';

export interface ToastSpec {
  text: string;
  tone: ToastTone;
}

/** Длительность эффектов «Попался на Вахте» и «Вышел!» (спека §2b: ~1,2 с). */
export const FX_MS = 1200;

/** Последний пойманный на Вахте: ключ seq перезапускает штамп, тряску и фишку фола. */
export interface CaughtFx {
  seq: number;
  at: number;
  offenders: PlayerId[];
  callerId: PlayerId;
}

export interface OutFx {
  seq: number;
  at: number;
}

/** Эффект ещё идёт: рамка, перемонтированная позже (смена экрана фазы), его не переигрывает. */
export function isFresh(fx: { at: number } | null | undefined, now: number = Date.now()): boolean {
  return !!fx && now - fx.at < FX_MS;
}

/** Что клиент помнит между срезами: для плашек статуса и анимаций. */
export interface RecentMarks {
  gameNumber: number;
  /** Счётчик эффектов в партии. */
  seq: number;
  acts: Record<PlayerId, 'took' | 'beat'>;
  vakhtaBy: PlayerId | null;
  /** Вызов в этой пачке событий кого-то поймал — у вызвавшего плашка «Поймал!». */
  vakhtaCaught: boolean;
  /** Живёт до следующего пойманного: CSS-анимация доигрывает сама и гаснет. */
  caught: CaughtFx | null;
  /** Кто когда вышел — ключ ленты «Вышел!» и конфетти. */
  outFx: Record<PlayerId, OutFx>;
  trumpCard: Card | null;
  opened: PlayerId[];
}

export function emptyMarks(gameNumber: number): RecentMarks {
  return { gameNumber, seq: 0, acts: {}, vakhtaBy: null, vakhtaCaught: false, caught: null, outFx: {}, trumpCard: null, opened: [] };
}

export function playerName(update: ClientUpdate, id: PlayerId): string {
  return update.players.find((p) => p.id === id)?.name ?? id;
}

export function nextMarks(prev: RecentMarks, update: ClientUpdate, now: number = Date.now()): RecentMarks {
  const base = prev.gameNumber === update.session.gameNumber ? prev : emptyMarks(update.session.gameNumber);
  if (update.events.length === 0) return base;
  let { seq, caught, outFx, trumpCard } = base;
  let acts = { ...base.acts };
  let vakhtaBy: PlayerId | null = null;
  let vakhtaCaught = false;
  const opened: PlayerId[] = [];
  for (const event of update.events) {
    switch (event.type) {
      case 'played':
        acts[event.playerId] = 'beat';
        break;
      case 'tookBottom':
        acts[event.playerId] = 'took';
        break;
      case 'vidbiy':
      case 'phase':
        acts = {};
        break;
      case 'vakhta':
        vakhtaBy = event.callerId;
        if (event.fouled.length > 0) {
          seq++;
          vakhtaCaught = true;
          caught = { seq, at: now, offenders: [...event.fouled], callerId: event.callerId };
        }
        break;
      case 'out':
        seq++;
        outFx = { ...outFx, [event.playerId]: { seq, at: now } };
        break;
      case 'trump':
        trumpCard = event.card;
        break;
      case 'prykupOpened':
        opened.push(event.playerId);
        break;
    }
  }
  return { gameNumber: base.gameNumber, seq, acts, vakhtaBy, vakhtaCaught, caught, outFx, trumpCard, opened };
}

export function eventToasts(update: ClientUpdate): ToastSpec[] {
  const toasts: ToastSpec[] = [];
  for (const event of update.events) {
    if (event.type === 'vakhta') {
      if (event.fouled.length === 0) toasts.push({ text: ru.toast.falseAlarm, tone: 'info' });
      for (const id of event.fouled) toasts.push({ text: ru.toast.vakhtaFoul(playerName(update, id)), tone: 'vakhta' });
    }
    if (event.type === 'stall') toasts.push({ text: ru.toast.stall[event.rule], tone: 'info' });
  }
  return toasts;
}

export function errorText(code: ErrorCode, view: PlayerView | null): string {
  return code === 'illegal_move' && view?.phase === 'phase2' ? ru.cannotBeat : ru.errors[code];
}

/** Выбор источника в фазе 1 живёт, пока мой ход и источник существует. */
export function keepSelection(selection: Selection, view: PlayerView): Selection {
  if (!selection || view.phase !== 'phase1' || view.turn !== view.me) return null;
  if (selection.kind === 'drawn') return view.drawn ? selection : null;
  return view.drawn ? null : selection;
}
