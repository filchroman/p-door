import type { PlayerView } from '@vakhta/engine';

/** Атрибуты зоны: имя и сколько карт в ней по срезу. */
export function zoneProps(zone: string, count: number) {
  return { 'data-zone': zone, 'data-count': count } as const;
}

/** Сколько карт должно лежать в каждой зоне по срезу (спека §2b «Честные счётчики»). */
export function expectedZones(view: PlayerView): Record<string, number> {
  const zones: Record<string, number> = { deck: view.deckCount, drawn: view.drawn ? 1 : 0, table: view.table.length };
  for (const p of view.players) {
    zones[`stack-${p.id}`] = p.stackCount;
    zones[`hand-${p.id}`] = p.handCount;
    zones[`prykup-${p.id}`] = p.prykupCount;
  }
  return zones;
}

/** Карт в игре = колода партии минус отбой. */
export function cardsInPlay(view: PlayerView): number {
  return view.deckSize - view.discardCount;
}

/**
 * Инвариант «в покое»: каждая зона нарисована не больше одного раза, в ней ровно столько элементов .card,
 * сколько в срезе (и сколько она сама объявила в data-count), зоны с картами не пропущены, сумма = cardsInPlay.
 */
export function zoneMismatches(root: ParentNode, view: PlayerView): string[] {
  const expected = expectedZones(view);
  const problems: string[] = [];
  const seen = new Map<string, number>();
  let total = 0;
  for (const zone of root.querySelectorAll<HTMLElement>('[data-zone]')) {
    const name = zone.dataset.zone!;
    // Рубашка переворачивающейся карты (.flip-in__back) — та же карта, не отдельная.
    const rendered = zone.querySelectorAll('.card').length - zone.querySelectorAll('.flip-in__back .card').length;
    const declared = Number(zone.dataset.count);
    total += rendered;
    seen.set(name, (seen.get(name) ?? 0) + 1);
    const want = expected[name] ?? 0;
    if (rendered !== want || declared !== want) problems.push(`${name}: expected ${want}, declared ${declared}, rendered ${rendered}`);
  }
  for (const [name, times] of seen) if (times > 1) problems.push(`${name}: rendered ${times} times`);
  for (const [name, want] of Object.entries(expected)) if (want > 0 && !seen.has(name)) problems.push(`${name}: expected ${want}, zone missing`);
  if (total !== cardsInPlay(view)) problems.push(`total: expected ${cardsInPlay(view)}, rendered ${total}`);
  return problems;
}
