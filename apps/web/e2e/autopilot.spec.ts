import { expect, test, type Page } from '@playwright/test';
import { ru } from '../src/i18n/ru';

/** Кадры перелётов, снятые в браузере: id летящей карты, время и её коробка на экране. */
interface FlightSample {
  id: number;
  t: number;
  x: number;
  y: number;
}

declare global {
  interface Window {
    __longTasks: number[];
    __flightFrames: FlightSample[];
  }
}

/** Смотрим за верхним слоем перелётов на каждом кадре — сколько карта реально летела и где была. */
async function recordFlights(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__flightFrames = [];
    let seq = 0;
    const ids = new WeakMap<Element, number>();
    const tick = () => {
      for (const el of document.querySelectorAll('.flight-layer .flight-card')) {
        if (!ids.has(el)) ids.set(el, ++seq);
        const r = el.getBoundingClientRect();
        window.__flightFrames.push({ id: ids.get(el)!, t: performance.now(), x: Math.round(r.left), y: Math.round(r.top) });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Инвариант «в покое» в браузере: сверяемся со срезом (window.__vakhta), а не с тем, что разметка
 * объявила о себе сама — иначе одна и та же ошибка могла бы сойтись сама с собой.
 *
 * Сверяются обе величины (спека §2c.2): `data-count` — точное число карт зоны из среза, а
 * нарисованных `.card` ровно столько, сколько зоне положено показать (`view.rendered`). Летящая
 * карта лежит в верхнем слое вне `.app-column`, поэтому в зонах её нет и счёт не плывёт.
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
      const drawn = zone.querySelectorAll('.card').length - zone.querySelectorAll('.flip-in__back .card').length;
      const want = view.rendered[name] ?? 0;
      const exact = view.zones[name] ?? 0;
      total += drawn;
      if (seen.has(name)) problems.push(`${name}: rendered twice`);
      seen.add(name);
      if (drawn !== want) problems.push(`${name}: drew ${drawn}, must draw ${want}`);
      if (Number(zone.dataset.count) !== exact) problems.push(`${name}: declared ${zone.dataset.count}, view says ${exact}`);
      if (Number(zone.dataset.shown) !== want) problems.push(`${name}: shows ${zone.dataset.shown}, must show ${want}`);
    }
    for (const [name, want] of Object.entries(view.rendered)) if (want > 0 && !seen.has(name)) problems.push(`${name}: zone missing, view says ${want}`);
    if (total !== view.shown) problems.push(`total: rendered ${total}, view says ${view.shown}`);
    if (total !== Number(table.dataset.shown)) problems.push(`total: rendered ${total}, declared ${table.dataset.shown}`);
    // Верхний слой перелётов живёт вне игровой колонки — иначе он попал бы в счёт зон (§2c.2).
    if (document.querySelector('.app-column .flight-layer')) problems.push('flight layer inside the game column');
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

/**
 * Каждый ход видно (спека §2c.1 «не меньше 8 кадров движения», §2c.2 «кадры с картой в
 * промежуточных точках»). Проверяем не то, что перелёт заведён, а то, что он реально прошёл по
 * экрану: карта живёт в верхнем слое положенные 380–520 мс и за это время бывает в десятках
 * различных точек между источником и приёмником, ни одна из которых не совпадает с концами.
 */
test('every move flies: the top layer really carries the card through intermediate points', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(ru.home.nickLabel).fill('Тест');
  await page.getByRole('radiogroup', { name: ru.home.players }).getByRole('radio', { name: '3', exact: true }).click();
  await page.getByRole('radiogroup', { name: ru.home.deck }).getByRole('radio', { name: '36', exact: true }).click();
  await page.getByRole('button', { name: ru.home.play }).click();
  await expect(page.getByTestId('player-p0')).toBeVisible();
  await recordFlights(page);

  await page.getByRole('button', { name: ru.debug.open }).click();
  const panel = page.getByRole('complementary', { name: ru.debug.title });
  await panel.getByRole('checkbox', { name: ru.debug.autopilot }).check();
  await page.getByRole('button', { name: ru.debug.open }).click();

  await expect
    .poll(() => page.evaluate(() => new Set(window.__flightFrames.map((f) => f.id)).size), { timeout: 60_000, intervals: [250] })
    .toBeGreaterThanOrEqual(5);
  // Даём последнему перелёту долететь, чтобы в замер не попала карта, срезанная на полпути.
  await page.waitForTimeout(1200);

  const flights = await page.evaluate(() => {
    const byId = new Map<number, FlightSample[]>();
    for (const f of window.__flightFrames) {
      if (!byId.has(f.id)) byId.set(f.id, []);
      byId.get(f.id)!.push(f);
    }
    // Карта, которая сейчас в воздухе, ещё не долетела: мерить её длительность нечестно.
    const settled = performance.now() - 700;
    return [...byId.values()]
      .filter((g) => g.length > 1 && g[g.length - 1].t < settled)
      .map((g) => {
        const first = g[0];
        const last = g[g.length - 1];
        const between = g.filter((f) => (f.x !== first.x || f.y !== first.y) && (f.x !== last.x || f.y !== last.y));
        return {
          ms: Math.round(last.t - first.t),
          frames: g.length,
          moved: Math.round(Math.hypot(last.x - first.x, last.y - first.y)),
          intermediate: new Set(between.map((f) => `${f.x},${f.y}`)).size,
        };
      });
  });

  expect(flights.length).toBeGreaterThanOrEqual(4);
  for (const flight of flights) {
    // Перелёт длится столько, сколько велит §2c.1, и не укорачивается догоняющей очередью.
    expect(flight.ms).toBeGreaterThanOrEqual(360);
    expect(flight.ms).toBeLessThanOrEqual(560);
    expect(flight.moved).toBeGreaterThan(20);
    expect(flight.intermediate).toBeGreaterThanOrEqual(8);
  }

  // Слой перелётов — в конце body и вне игровой колонки, иначе его обрежет overflow колонки (§2c.2).
  const layer = await page.evaluate(() => {
    const el = document.querySelector('.flight-layer');
    return el ? { inBody: el.parentElement === document.body, inColumn: !!el.closest('.app-column') } : null;
  });
  expect(layer).toEqual({ inBody: true, inColumn: false });
});
