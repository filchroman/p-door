import { createHmac, timingSafeEqual } from 'node:crypto';

/** Пользователь Telegram из `initData` Mini App. */
export interface TelegramUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  photoUrl: string;
}

export interface TelegramAuth {
  user: TelegramUser;
  /** Код комнаты из ссылки-приглашения `?startapp=<CODE>`, если открыли по ней. */
  startParam: string | null;
  authDate: number;
}

/** Данные старше этого не принимаем: подпись верна, но её могли переслать. */
export const INIT_DATA_MAX_AGE_S = 24 * 60 * 60;

/** Подпись `initData` по правилам Telegram: HMAC-SHA256, ключ — HMAC("WebAppData", токен бота). */
export function signInitData(pairs: Record<string, string>, botToken: string): string {
  const checkString = Object.keys(pairs)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${pairs[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secret).update(checkString).digest('hex');
}

/**
 * Проверяет `initData` и достаёт пользователя. `null` — подпись не сходится, данные просрочены
 * или в них нет пользователя: такое подключение сервер не принимает.
 */
export function verifyInitData(initData: string, botToken: string, now: number = Date.now()): TelegramAuth | null {
  const params = new URLSearchParams(initData);
  const pairs: Record<string, string> = {};
  for (const [key, value] of params) pairs[key] = value;
  const hash = pairs.hash;
  if (!hash || !botToken) return null;
  const expected = signInitData(pairs, botToken);
  if (expected.length !== hash.length || !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash, 'hex'))) return null;
  const authDate = Number(pairs.auth_date);
  if (!Number.isFinite(authDate) || now / 1000 - authDate > INIT_DATA_MAX_AGE_S) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(pairs.user ?? '');
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || typeof (raw as { id?: unknown }).id !== 'number') return null;
  const u = raw as { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string };
  return {
    user: {
      id: u.id,
      firstName: u.first_name ?? '',
      lastName: u.last_name ?? '',
      username: u.username ?? '',
      photoUrl: u.photo_url ?? '',
    },
    startParam: pairs.start_param ?? null,
    authDate,
  };
}

/** Имя для стола: «Имя Фамилия», иначе @username, иначе «Игрок». */
export function displayName(user: TelegramUser, fallback: string): string {
  const full = `${user.firstName} ${user.lastName}`.trim();
  return full || (user.username ? `@${user.username}` : fallback);
}
