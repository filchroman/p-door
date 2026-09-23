/**
 * Тонкая обёртка над `window.Telegram.WebApp` (скрипт подключён в index.html). Вне Telegram
 * все методы безвредны: страница работает как обычный сайт с анонимным входом.
 */

export interface TelegramProfile {
  id: number;
  name: string;
  photoUrl: string;
}

interface WebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface WebApp {
  initData: string;
  initDataUnsafe: { user?: WebAppUser; start_param?: string };
  ready(): void;
  expand(): void;
  openTelegramLink(url: string): void;
  shareMessage?(id: string, callback?: (sent: boolean) => void): void;
  isVersionAtLeast?(version: string): boolean;
  colorScheme?: 'light' | 'dark';
}

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

function webApp(): WebApp | null {
  const app = typeof window === 'undefined' ? undefined : window.Telegram?.WebApp;
  return app && app.initData ? app : null;
}

export function isTelegram(): boolean {
  return webApp() !== null;
}

/** Подписанные данные для сервера; пусто вне Telegram. */
export function telegramInitData(): string {
  return webApp()?.initData ?? '';
}

/** Код комнаты из ссылки-приглашения `?startapp=<CODE>`. */
export function telegramStartParam(): string | null {
  return webApp()?.initDataUnsafe.start_param ?? null;
}

/** Профиль для показа до ответа сервера (сервер всё равно проверит подпись и пришлёт своё). */
export function telegramProfile(): TelegramProfile | null {
  const user = webApp()?.initDataUnsafe.user;
  if (!user) return null;
  const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || (user.username ? `@${user.username}` : '');
  return { id: user.id, name, photoUrl: user.photo_url ?? '' };
}

/** Сообщить Telegram, что интерфейс готов, и развернуть окно на всю высоту. */
export function telegramReady(): void {
  const app = webApp();
  if (!app) return;
  try {
    app.ready();
    app.expand();
  } catch {
    // старый клиент Telegram — без развёртывания
  }
}

/** Открыть окно «поделиться» Telegram с готовой ссылкой; вне Telegram — false. */
export function telegramShare(url: string, text: string): boolean {
  const app = webApp();
  if (!app) return false;
  app.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
  return true;
}

/** Есть ли у этого клиента Telegram отправка подготовленного сообщения (Bot API 8.0+). */
export function telegramCanShareMessage(): boolean {
  const app = webApp();
  return !!app && typeof app.shareMessage === 'function' && (app.isVersionAtLeast?.('8.0') ?? false);
}

/** Показать выбор чата и отправить подготовленное ботом сообщение-приглашение. */
export function telegramShareMessage(id: string): Promise<boolean> {
  const app = webApp();
  if (!app || typeof app.shareMessage !== 'function') return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      app.shareMessage!(id, (sent) => resolve(sent));
    } catch {
      resolve(false);
    }
  });
}
