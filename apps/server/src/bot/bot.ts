import { Bot, InlineKeyboard } from 'grammy';

export interface BotConfig {
  token: string;
  /** Публичный адрес игры: сюда открывается Mini App. */
  appUrl: string;
}

/**
 * Бот: `/start` отвечает кнопкой «Играть», открывающей Mini App; кнопка меню чата ведёт туда же.
 * Работает по long polling — вебхук и лишняя настройка не нужны.
 */
export function createBot({ token, appUrl }: BotConfig): Bot {
  const bot = new Bot(token);
  bot.command('start', async (ctx) => {
    const payload = ctx.match?.trim();
    // Ссылка-приглашение вида t.me/<bot>?start=<CODE> тоже ведёт в комнату.
    const url = payload ? `${appUrl}/r/${encodeURIComponent(payload)}` : appUrl;
    const keyboard = new InlineKeyboard().webApp(payload ? 'Войти в комнату' : 'Играть', url);
    await ctx.reply(
      payload
        ? `Вас зовут в комнату ${payload}. Жмите кнопку — и вы за столом.`
        : 'Вахта — карточная игра для компании. Создайте комнату и отправьте друзьям ссылку, или потренируйтесь с ботами.',
      { reply_markup: keyboard },
    );
  });
  bot.command('help', (ctx) => ctx.reply('Команда /start открывает игру. Комнату создаёт один из вас, остальные заходят по ссылке.'));
  return bot;
}

/** Кнопка меню у всех чатов с ботом — «Играть». Один вызов при старте сервера. */
export async function installMenuButton(bot: Bot, appUrl: string): Promise<void> {
  await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Играть', web_app: { url: appUrl } } });
}
