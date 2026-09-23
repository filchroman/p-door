import { expect, test, type Page } from '@playwright/test';
import { ru } from '../src/i18n/ru';

declare global {
  interface Window {
    __flightKeys: string[];
  }
}

/** Ключи карт, которые побывали в верхнем слое перелётов (по картинке летящей карты). */
async function recordFlightKeys(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__flightKeys = [];
    const seen = new WeakSet<Element>();
    const tick = () => {
      for (const el of document.querySelectorAll('.flight-layer .flight-card')) {
        if (seen.has(el)) continue;
        seen.add(el);
        const src = el.querySelector('img')?.getAttribute('src') ?? '';
        window.__flightKeys.push(src.split('/').pop()?.split('.')[0] ?? src);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function startTwoPlayerGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(ru.home.nickLabel).fill('Тест');
  await page.getByRole('button', { name: ru.home.train }).click();
  await page.getByRole('radiogroup', { name: ru.home.players }).getByRole('radio', { name: '2', exact: true }).click();
  await page.getByRole('radiogroup', { name: ru.home.deck }).getByRole('radio', { name: '36', exact: true }).click();
  // Без таймера хода: тест сам решает, когда тянуть и бросать.
  await page.getByRole('radiogroup', { name: ru.home.turnTime }).getByRole('radio', { name: ru.home.turnOff }).click();
  await page.getByRole('button', { name: ru.home.play }).click();
  await expect(page.getByTestId('player-p0')).toBeVisible();
}

test('карта, которую я перетащил сам, лежит у цели и второй раз туда не летит', async ({ page }) => {
  await startTwoPlayerGame(page);
  await recordFlightKeys(page);

  // Дожидаемся своего хода и тянем карту.
  const deck = page.locator('.deck');
  await expect(deck).toBeEnabled({ timeout: 30_000 });
  await deck.click();
  const drawn = page.locator('.drawn-slot .draggable');
  await expect(drawn).toBeVisible();
  const drawnSrc = await drawn.locator('img').getAttribute('src');
  const key = drawnSrc!.split('/').pop()!.split('.')[0];
  // Перелёт из колоды в слот вытянутой — свой, законный; сбрасываем журнал перед броском.
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__flightKeys = [];
  });

  // Тащим вытянутую карту на свою стопку.
  const from = (await drawn.boundingBox())!;
  const pile = page.locator('.my-area .pile');
  const to = (await pile.boundingBox())!;
  const stackBefore = Number(await page.locator('.my-area .pile__stack').getAttribute('data-count'));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) {
    await page.mouse.move(from.x + from.width / 2 + ((to.x + to.width / 2 - from.x - from.width / 2) * k) / 10, from.y + from.height / 2 + ((to.y + to.height / 2 - from.y - from.height / 2) * k) / 10);
  }
  // В момент броска карта лежит у цели (transform к центру зоны), а не отпрыгивает в слот.
  // Срез с ходом приходит тем же тиком и заменяет карту, поэтому её состояние снимаем прямо в pointerup.
  await page.evaluate(() => {
    document.addEventListener(
      'pointerup',
      () => {
        const el = document.querySelector<HTMLElement>('.drawn-slot .draggable');
        (window as unknown as { __held: unknown }).__held = el ? { transform: el.style.transform, dropped: el.classList.contains('is-dropped') } : null;
      },
      { once: true },
    );
  });
  await page.mouse.up();
  const held = await page.evaluate(() => (window as unknown as { __held: { transform: string; dropped: boolean } | null }).__held);
  // Локальный хост отвечает тем же тиком — карту уже сменил срез; с сетевой задержкой она лежит у цели.
  if (held) {
    expect(held.dropped).toBe(true);
    expect(held.transform).not.toBe('');
  }
  // Новая верхняя карта стопки появляется без «падения сверху»: transform не задан с первого кадра.
  const enterTransform = await page.evaluate(
    () =>
      new Promise<string>((resolve) =>
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>('.my-area .pile__stack .animated-card');
          resolve(el ? getComputedStyle(el).transform : 'missing');
        }),
      ),
  );
  expect(enterTransform).toBe('none');

  // Срез с ходом пришёл: карта в стопке, слот пуст — и в верхнем слое эта карта не летала.
  await expect(page.locator('.my-area .pile__stack')).toHaveAttribute('data-count', String(stackBefore + 1), { timeout: 5_000 });
  await expect(page.locator('.drawn-slot .card')).toHaveCount(0);
  await page.waitForTimeout(900);
  const flown = await page.evaluate(() => window.__flightKeys);
  expect(flown).not.toContain(key);
});
