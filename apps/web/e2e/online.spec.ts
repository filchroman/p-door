import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ru } from '../src/i18n/ru';

/**
 * Два настоящих браузера в одной комнате: сервер комнат поднимается на своём порту и раздаёт
 * собранный клиент (как в проде), Рома создаёт комнату, Галя входит по ссылке /r/CODE, хост
 * стартует — и у обоих открывается стол с одним и тем же кодом комнаты и разными «я».
 */
const PORT = 3977;
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('node', ['../server/dist/index.js'], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', BOT_TOKEN: '', PUBLIC_URL: '' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch {
      // ещё не поднялся
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

test.afterAll(() => {
  server.kill();
});

async function openAs(browser: Browser, nick: string, path = '/'): Promise<Page> {
  const context = await browser.newContext();
  // Ник — как у вернувшегося игрока: по ссылке /r/CODE клиент подключается сразу, не спрашивая имени.
  await context.addInitScript((value: string) => localStorage.setItem('vakhta.nick', value), nick);
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`);
  return page;
}

test('комната по ссылке: двое входят и играют на одном сервере', async ({ browser }) => {
  const roma = await openAs(browser, 'Рома');
  await roma.getByRole('button', { name: ru.home.createRoom }).click();
  await roma.getByRole('radiogroup', { name: ru.home.players }).getByRole('radio', { name: '2', exact: true }).click();
  await roma.getByRole('radiogroup', { name: ru.home.turnTime }).getByRole('radio', { name: ru.home.turnOff }).click();
  await roma.getByRole('button', { name: ru.home.create }).click();
  const code = (await roma.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}$/);
  await expect(roma.getByText(ru.lobby.seats(1, 2))).toBeVisible();

  // Галя открывает ссылку с кодом — и сразу в лобби, без ввода кода.
  const galya = await openAs(browser, 'Галя', `/r/${code}`);
  await expect(galya.getByTestId('room-code')).toHaveText(code);
  await expect(galya.getByRole('status')).toHaveText(ru.lobby.waiting);
  await expect(roma.getByText(ru.lobby.seats(2, 2))).toBeVisible();
  await expect(roma.getByText('Галя')).toBeVisible();

  await roma.getByRole('button', { name: ru.lobby.start }).click();
  await expect(roma.locator('.table-screen')).toBeVisible();
  await expect(galya.locator('.table-screen')).toBeVisible();
  // У каждого свой срез: «я» разные, стол один.
  const romaMe = await roma.evaluate(() => (window as unknown as { __vakhta?: { phase: string } }).__vakhta?.phase);
  const galyaMe = await galya.evaluate(() => (window as unknown as { __vakhta?: { phase: string } }).__vakhta?.phase);
  expect(romaMe).toBe('phase1');
  expect(galyaMe).toBe('phase1');
  await expect(roma.locator('.bottom-bar')).toContainText('Рома');
  await expect(galya.locator('.bottom-bar')).toContainText('Галя');
  await expect(roma.locator('.opponents')).toContainText('Галя');
  await expect(galya.locator('.opponents')).toContainText('Рома');

  // Тот, чей ход, тянет карту — соперник видит вытянутую карту в слоте.
  const mover = (await roma.locator('.deck').isEnabled()) ? roma : galya;
  const other = mover === roma ? galya : roma;
  await mover.locator('.deck').click();
  // В слоте вытянутой карта одна (зона объявляет счёт; рубашка переворота — та же карта).
  await expect(other.locator('[data-zone="drawn"]')).toHaveAttribute('data-count', '1');
});
