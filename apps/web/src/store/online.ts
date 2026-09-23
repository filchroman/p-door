import type { Auth } from '@vakhta/protocol';
import { ru } from '../i18n/ru';
import { isTelegram, telegramInitData, telegramStartParam } from '../telegram';

export const ANON_TOKEN_KEY = 'vakhta.token';

export interface InviteConfig {
  botUsername: string;
  appShortName: string;
}

/** Анонимный токен устройства: по нему сервер возвращает место после переподключения. */
export function anonToken(): string {
  try {
    const stored = localStorage.getItem(ANON_TOKEN_KEY);
    if (stored) return stored;
  } catch {
    // приватный режим — токен на одну сессию
  }
  const token = crypto.randomUUID();
  try {
    localStorage.setItem(ANON_TOKEN_KEY, token);
  } catch {
    // ничего: токен живёт до перезагрузки
  }
  return token;
}

/** Как входим: через Telegram, если открыты как Mini App, иначе анонимно по нику. */
export function buildAuth(nick: string): Auth {
  if (isTelegram()) return { kind: 'telegram', initData: telegramInitData() };
  return { kind: 'anon', token: anonToken(), nick: nick.trim() || ru.defaultNick };
}

/** Код комнаты из адреса `/r/K7PQ` (браузер) или из ссылки-приглашения Telegram. */
export function roomCodeFromLocation(pathname: string = typeof location === 'undefined' ? '' : location.pathname): string | null {
  const fromTelegram = telegramStartParam();
  if (fromTelegram) return fromTelegram.toUpperCase();
  const match = /^\/r\/([A-Za-z0-9]{3,8})\/?$/.exec(pathname);
  return match ? match[1].toUpperCase() : null;
}

/** Ссылка-приглашение: в Telegram — прямая ссылка Mini App, иначе адрес страницы с кодом. */
export function inviteLink(code: string, config: InviteConfig | null, origin: string = typeof location === 'undefined' ? '' : location.origin): string {
  if (config?.botUsername && config.appShortName) return `https://t.me/${config.botUsername}/${config.appShortName}?startapp=${code}`;
  return `${origin}/r/${code}`;
}

/** Адрес WebSocket-шлюза рядом со страницей: в dev его проксирует Vite. */
export function wsUrl(loc: { protocol: string; host: string } = location): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws`;
}
