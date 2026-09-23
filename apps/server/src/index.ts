import { buildApp, defaultWebDist } from './app';
import { createBot, installMenuButton, inviteLink, prepareInvite } from './bot/bot';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const botToken = process.env.BOT_TOKEN ?? '';
const botUsername = process.env.BOT_USERNAME ?? '';
const appShortName = process.env.APP_SHORT_NAME ?? 'game';
const publicUrl = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');

const bot = botToken && publicUrl ? createBot({ token: botToken, appUrl: publicUrl }) : null;
const { app } = buildApp({
  botToken,
  botUsername,
  appShortName,
  webDist: process.env.WEB_DIST ?? defaultWebDist(),
  prepareInvite: bot && botUsername ? (userId, code, fromName) => prepareInvite(bot, userId, inviteLink(botUsername, appShortName, code), code, fromName) : undefined,
});

await app.listen({ port, host });
console.log(`vakhta server on http://${host}:${port}`);

if (bot) {
  try {
    await installMenuButton(bot, publicUrl);
  } catch (error) {
    console.error('menu button:', error);
  }
  void bot.start({ onStart: () => console.log('bot polling') });
  const stop = async () => {
    await bot.stop();
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} else {
  console.log('BOT_TOKEN or PUBLIC_URL not set — bot disabled, anonymous login only');
}
