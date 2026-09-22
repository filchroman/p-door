import { ru } from '../i18n/ru';
import type { SeatInfo } from './types';

/** Место p0 — человек, остальные — боты с именами и аватарками из набора. */
export function makeSeats(nick: string, playerCount: number): SeatInfo[] {
  const seats: SeatInfo[] = [{ id: 'p0', name: nick.trim() || ru.defaultNick, avatar: ru.humanAvatar, isBot: false }];
  for (let i = 1; i < playerCount; i++) {
    seats.push({ id: `p${i}`, name: ru.botNames[i - 1], avatar: ru.botAvatars[i - 1], isBot: true });
  }
  return seats;
}
