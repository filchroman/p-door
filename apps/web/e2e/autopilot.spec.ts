import { expect, test, type Page } from '@playwright/test';
import { ru } from '../src/i18n/ru';

declare global {
  interface Window {
    __longTasks: number[];
  }
}

/** Инвариант «в покое» в браузере: каждая зона рисует ровно data-count карт, сумма = data-total. */
async function zonesAtRest(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>('.table-screen');
    if (!table) return ['no table'];
    const problems: string[] = [];
    let total = 0;
    for (const zone of table.parentElement!.querySelectorAll<HTMLElement>('[data-zone]')) {
      const rendered = zone.querySelectorAll('.card').length - zone.querySelectorAll('.flip-in__back .card').length;
      total += rendered;
      if (rendered !== Number(zone.dataset.count)) problems.push(`${zone.dataset.zone}: ${rendered}/${zone.dataset.count}`);
    }
    if (total !== Number(table.dataset.total)) problems.push(`total: ${total}/${table.dataset.total}`);
    return problems;
  });
}

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
  await expect(page.getByRole('button', { name: ru.results.again })).toBeVisible();
  const longest = await page.evaluate(() => Math.max(0, ...window.__longTasks));
  expect(longest).toBeLessThanOrEqual(200);
});
