import { Bot, InlineKeyboard } from 'grammy';

export interface BotConfig {
  token: string;
  /** Публичный адрес игры: сюда открывается Mini App. */
  appUrl: string;
}

/**
 * Ссылка, открывающая Mini App сразу в комнате: с коротким именем приложения (/newapp) — прямая
 * ссылка на него; без — на самого бота (работает, если в BotFather включён Main Mini App).
 */
export function inviteLink(botUsername: string, appShortName: string, code: string): string {
  return appShortName ? `https://t.me/${botUsername}/${appShortName}?startapp=${code}` : `https://t.me/${botUsername}?startapp=${code}`;
}

/**
 * Приглашение другу как сообщение с кнопкой «Войти в комнату» (Bot API: prepared inline message).
 * Mini App потом отдаёт его в `shareMessage` — Telegram сам показывает выбор чата и отправляет.
 */
export async function prepareInvite(bot: Bot, userId: number, link: string, code: string, fromName: string): Promise<string> {
  const prepared = await bot.api.savePreparedInlineMessage(
    userId,
    {
      type: 'article',
      id: `invite-${code}`,
      title: `Приглашение в «Вахту» — комната ${code}`,
      input_message_content: { message_text: `${fromName} зовёт сыграть в «Вахту». Комната ${code} — жми кнопку и заходи!` },
      reply_markup: new InlineKeyboard().url('Войти в комнату', link),
    },
    { allow_user_chats: true, allow_group_chats: true, allow_bot_chats: false, allow_channel_chats: false },
  );
  return prepared.id;
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
