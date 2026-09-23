import type { PlayerId, PlayerView } from '@vakhta/engine';

/** Атрибуты зоны: имя, сколько карт в ней по срезу (число точное) и сколько из них нарисовано. */
export function zoneProps(zone: string, count: number, shown = count) {
  return { 'data-zone': zone, 'data-count': count, 'data-shown': shown } as const;
}

/**
 * Пределы показа (спека §2c.2). Точным обязано быть **число** рядом с зоной (`handCount`,
 * `stackCount`, `prykupCount`, `deckCount`) — а рубашек рисуется не больше предела: ряд из
 * тридцати рубашек растягивал экран по вертикали и по горизонтали и читался хуже, чем цифра.
 * Своя рука не ограничена: в ней лежат настоящие карты, и играть надо каждой.
 */
export const FAN_CAP = 6;
/** Прикуп рисуется только цифрой (чип на аватарке), карт в зоне нет. */
export const PRYKUP_CAP = 0;
export const STACK_CAP = 6;
export const DECK_CAP = 8;

/** Сколько карт зона рисует максимум. Бесконечность — рисуются все. */
export function zoneLimit(zone: string, me: PlayerId): number {
  if (zone === 'deck') return DECK_CAP;
  if (zone.startsWith('prykup-')) return PRYKUP_CAP;
  if (zone.startsWith('stack-')) return STACK_CAP;
  if (zone === `hand-${me}`) return Infinity;
  if (zone.startsWith('hand-')) return FAN_CAP;
  return Infinity;
}

/** Сколько карт в зоне по срезу — точное число, то самое, что стоит рядом цифрой (спека §2b). */
export function expectedZones(view: PlayerView): Record<string, number> {
  const zones: Record<string, number> = { deck: view.deckCount, drawn: view.drawn ? 1 : 0, table: view.table.length };
  for (const p of view.players) {
    zones[`stack-${p.id}`] = p.stackCount;
    zones[`hand-${p.id}`] = p.handCount;
    zones[`prykup-${p.id}`] = p.prykupCount;
  }
  return zones;
}

/** Сколько карт зона обязана нарисовать: то же число, но не больше предела показа (спека §2c.2). */
export function renderedZones(view: PlayerView): Record<string, number> {
  const rendered: Record<string, number> = {};
  for (const [zone, count] of Object.entries(expectedZones(view))) rendered[zone] = Math.min(count, zoneLimit(zone, view.me));
  return rendered;
}

/** Карт в игре = колода партии минус отбой. */
export function cardsInPlay(view: PlayerView): number {
  return view.deckSize - view.discardCount;
}

/** Сколько карт всего нарисовано на столе с учётом пределов показа. */
export function cardsShown(view: PlayerView): number {
  return Object.values(renderedZones(view)).reduce((sum, n) => sum + n, 0);
}

/**
 * Инвариант «в покое»: каждая зона нарисована не больше одного раза, в ней ровно столько элементов
 * `.card`, сколько ей положено показать, объявленное `data-count` — точное число карт из среза,
 * зоны с картами не пропущены, сумма нарисованного равна `cardsShown`.
 */
export function zoneMismatches(root: ParentNode, view: PlayerView): string[] {
  const expected = expectedZones(view);
  const rendered = renderedZones(view);
  const problems: string[] = [];
  const seen = new Map<string, number>();
  let total = 0;
  for (const zone of root.querySelectorAll<HTMLElement>('[data-zone]')) {
    const name = zone.dataset.zone!;
    // Рубашка переворачивающейся карты (.flip-in__back) — та же карта, не отдельная.
    const drawn = zone.querySelectorAll('.card').length - zone.querySelectorAll('.flip-in__back .card').length;
    total += drawn;
    seen.set(name, (seen.get(name) ?? 0) + 1);
    const want = rendered[name] ?? 0;
    const exact = expected[name] ?? 0;
    if (drawn !== want) problems.push(`${name}: must draw ${want}, drew ${drawn}`);
    if (Number(zone.dataset.count) !== exact) problems.push(`${name}: declared ${zone.dataset.count}, view says ${exact}`);
    if (Number(zone.dataset.shown) !== want) problems.push(`${name}: shows ${zone.dataset.shown}, must show ${want}`);
  }
  for (const [name, times] of seen) if (times > 1) problems.push(`${name}: rendered ${times} times`);
  for (const [name, want] of Object.entries(rendered)) if (want > 0 && !seen.has(name)) problems.push(`${name}: expected ${want}, zone missing`);
  if (total !== cardsShown(view)) problems.push(`total: expected ${cardsShown(view)}, rendered ${total}`);
  return problems;
}
