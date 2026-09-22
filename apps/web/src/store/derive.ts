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

/**
 * Сколько держать стол, прежде чем открыть итоги: движок шлёт `out` и `gameOver` одной пачкой,
 * и без этого такта лента «Вышел!» с конфетти не успевают показаться вовсе (спека §2b).
 * Стол должен быть на экране (прошлый срез — игра), кто-то должен выйти (сдача — сразу итоги),
 * очередь догоняет состояние — такт короче, «меньше движения» — его нет.
 */
export function celebrationHoldMs({
  prev,
  next,
  speed,
  reduced,
}: {
  prev: ClientUpdate | null;
  next: ClientUpdate;
  speed: number;
  reduced: boolean;
}): number {
  if (reduced) return 0;
  if (!prev || prev.session.status !== 'playing') return 0;
  if (next.session.status !== 'gameOver') return 0;
  if (!next.events.some((event) => event.type === 'out')) return 0;
  return Math.round(FX_MS / Math.max(1, speed));
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
  opened: PlayerId[];
}

export function emptyMarks(gameNumber: number): RecentMarks {
  return { gameNumber, seq: 0, acts: {}, vakhtaBy: null, vakhtaCaught: false, caught: null, outFx: {}, opened: [] };
}

export function playerName(update: ClientUpdate, id: PlayerId): string {
  return update.players.find((p) => p.id === id)?.name ?? id;
}

export function nextMarks(prev: RecentMarks, update: ClientUpdate, now: number = Date.now()): RecentMarks {
  const base = prev.gameNumber === update.session.gameNumber ? prev : emptyMarks(update.session.gameNumber);
  if (update.events.length === 0) return base;
  let { seq, caught, outFx } = base;
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
      case 'prykupOpened':
        opened.push(event.playerId);
        break;
    }
  }
  return { gameNumber: base.gameNumber, seq, acts, vakhtaBy, vakhtaCaught, caught, outFx, opened };
}

/**
 * Карты, которые этот срез отправил в отбой: стол прошлого среза плюс сыгранное в этом же срезе
 * (движок кладёт карту на стол и тут же закрывает отбой). Взятая нижняя сюда не попадает —
 * она переезжает в руку одним элементом по общему layoutId, а не улетает.
 * Верим не событию, а отбою: вынужденный отбой на уже пустом столе (разбор затора) ничего
 * не кладёт, и тогда улетать нечему — иначе взятая нижняя улетала бы, лёжа в руке.
 */
export function sweptCards(prev: ClientUpdate | null, update: ClientUpdate): Card[] {
  if (!update.events.some((event) => event.type === 'vidbiy')) return [];
  if (update.view.discardCount <= (prev?.view.discardCount ?? 0)) return [];
  const before = prev ? prev.view.table.map((t) => t.card) : [];
  const played = update.events.flatMap((event) => (event.type === 'played' ? [event.card] : []));
  return [...before, ...played];
}

/** Кто сейчас действует и что именно сделал: подсветка рамки и подпись рядом с ней (спека §2c). */
export interface ActingFx {
  id: PlayerId;
  text: string;
  /** Растёт на каждое действие: перезапускает появление подписи, даже если текст тот же. */
  seq: number;
}

/**
 * Подпись выводится из событий одного применённого действия — очередь показывает срезы по одному,
 * поэтому в пачке ровно одно действие игрока. Последствия (`vidbiy`, `out`, `trump`) — не действия.
 */
export function actingFrom(update: ClientUpdate, seq: number): ActingFx | null {
  for (const event of update.events) {
    switch (event.type) {
      case 'drew':
        return { id: event.playerId, text: ru.act.drew, seq };
      case 'kept':
        return { id: event.playerId, text: ru.act.kept, seq };
      case 'played':
        return { id: event.playerId, text: ru.act.played, seq };
      case 'tookBottom':
        return { id: event.playerId, text: ru.act.tookBottom, seq };
      case 'placed':
        // «+1» на свою же стопку — не нарушение (спека §2.2), но и не перекладывание сопернику.
        return { id: event.playerId, text: event.to === event.playerId ? ru.act.kept : ru.act.moved(playerName(update, event.to)), seq };
      case 'movedTop':
        return { id: event.from, text: ru.act.moved(playerName(update, event.to)), seq };
    }
  }
  return null;
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
