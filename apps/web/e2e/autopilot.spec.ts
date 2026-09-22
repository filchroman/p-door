import { expect, test, type Page } from '@playwright/test';
import { ru } from '../src/i18n/ru';

declare global {
  interface Window {
    __longTasks: number[];
  }
}

/**
 * Инвариант «в покое» в браузере: сверяемся со срезом (window.__vakhta), а не с тем, что разметка
 * объявила о себе сама — иначе одна и та же ошибка могла бы сойтись сама с собой. Заодно проверяем
 * и data-count: он обязан совпадать с тем же срезом.
 */
async function zonesAtRest(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const view = window.__vakhta;
    const table = document.querySelector<HTMLElement>('.table-screen');
    if (!view) return ['no view on window'];
    if (!table) return ['no table'];
    const problems: string[] = [];
    const seen = new Set<string>();
    let total = 0;
    for (const zone of table.parentElement!.querySelectorAll<HTMLElement>('[data-zone]')) {
      const name = zone.dataset.zone!;
      const rendered = zone.querySelectorAll('.card').length - zone.querySelectorAll('.flip-in__back .card').length;
      const want = view.zones[name] ?? 0;
      total += rendered;
      if (seen.has(name)) problems.push(`${name}: rendered twice`);
      seen.add(name);
      if (rendered !== want) problems.push(`${name}: rendered ${rendered}, view says ${want}`);
      if (Number(zone.dataset.count) !== want) problems.push(`${name}: declared ${zone.dataset.count}, view says ${want}`);
    }
    for (const [name, want] of Object.entries(view.zones)) if (want > 0 && !seen.has(name)) problems.push(`${name}: zone missing, view says ${want}`);
    if (total !== view.total) problems.push(`total: rendered ${total}, view says ${view.total}`);
    if (total !== Number(table.dataset.total)) problems.push(`total: rendered ${total}, declared ${table.dataset.total}`);
    return problems;
  });
}

const gameNumber = (page: Page) => page.evaluate(() => window.__vakhta?.gameNumber ?? 0);

test('autopilot at max bot speed reaches the round results smoothly and with exact card counts', async ({ page }) => {
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  });

  await page.goto('/');
  await page.getByLabel(ru.home.nickLabel).fill('Тест');
  await page.getByRole('radiogroup', { name: ru.home.players }).getByRole('radio', { name: '3', exact: true }).click();
  await page.getByRole('radiogroup', { name: ru.home.deck }).getByRole('radio', { name: '36', exact: true }).click();
  await page.getByRole('button', { name: ru.home.play }).click();
  await expect(page.getByTestId('player-p0')).toContainText('Тест');
  await expect.poll(() => zonesAtRest(page), { timeout: 10_000, intervals: [50] }).toEqual([]);

  await page.getByRole('button', { name: ru.debug.open }).click();
  const panel = page.getByRole('complementary', { name: ru.debug.title });
  await panel
    .getByRole('radiogroup', { name: ru.debug.botSpeed })
    .getByRole('radio', { name: ru.debug.speed(3), exact: true })
    .click();
  await panel.getByRole('checkbox', { name: ru.debug.autopilot }).check();
  await page.getByRole('button', { name: ru.debug.open }).click();
  await page.evaluate(() => {
    window.__longTasks = [];
  });

  await expect(page.locator('.table-fan')).toBeVisible({ timeout: 180_000 });
  await expect.poll(() => zonesAtRest(page), { timeout: 10_000, intervals: [50] }).toEqual([]);
  await page.waitForTimeout(8_000);
  if (await page.locator('.table-screen').count()) {
    await expect.poll(() => zonesAtRest(page), { timeout: 10_000, intervals: [50] }).toEqual([]);
  }

  await expect(page.getByRole('heading', { name: ru.results.title })).toBeVisible({ timeout: 240_000 });
  const longest = await page.evaluate(() => Math.max(0, ...window.__longTasks));
  expect(longest).toBeLessThanOrEqual(200);

  // Вторая партия: переход между партиями — то место, где на столе легко остаётся лишнее.
  await page.getByRole('button', { name: ru.results.again }).click();
  await expect(page.locator('.table-screen')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => gameNumber(page), { timeout: 30_000, intervals: [50] }).toBe(2);
  await expect.poll(() => zonesAtRest(page), { timeout: 10_000, intervals: [50] }).toEqual([]);
  await page.waitForTimeout(8_000);
  if (await page.locator('.table-screen').count()) {
    await expect.poll(() => zonesAtRest(page), { timeout: 10_000, intervals: [50] }).toEqual([]);
  }
});
