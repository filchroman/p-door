/**
 * Размеры карт и геометрия веера (спека §2c.1 «Читаемые размеры и темп»).
 *
 * Ширины здесь и в table.css — одно и то же число: CSS держит `clamp()` как значение по умолчанию,
 * а веер руки получает ту же ширину из JS вместе с рассчитанным перекрытием.
 */

/** Своя рука, стол, колода и вытянутая карта: clamp(84px, 22vw, 110px), пропорции 2:3. */
export const BIG_CARD_MIN = 84;
export const BIG_CARD_MAX = 110;
export const BIG_CARD_VW = 0.22;
/** Стопки соперников, рубашки, прикуп: clamp(64px, 17vw, 84px). */
export const SMALL_CARD_MIN = 64;
export const SMALL_CARD_MAX = 84;
export const SMALL_CARD_VW = 0.17;
/**
 * Тесный стол (спека §2c.2). Пятеро соперников по §2c.1 (карта ≥ 64 px, аватарка 44) занимают
 * втрое больше высоты, чем есть на 375×812, и экран получает прокрутку — а §2c.2 требует, чтобы
 * при 2–6 игроках всё помещалось без неё. Поэтому до трёх соперников размеры §2c.1 держатся как
 * есть, а с четырёх карта соперника ужимается: её ранг всё ещё читается, а цифра рядом точна всегда.
 */
export const CROWDED_FROM = 4;
export const CROWDED_CARD = 54;
/** Рубашки соперника и прикупа: информации на них нет, число рядом — точное (спека §2c.2). */
export const MINI_CARD_MIN = 30;
export const MINI_CARD_MAX = 38;
export const MINI_CARD_VW = 0.08;
export const CROWDED_MINI = 28;
export const AVATAR_ROOMY = 40;
export const AVATAR_CROWDED = 34;

/** Игровая колонка на широком экране (theme.css, `.app-column`). */
export const COLUMN_MAX = 480;
/** Поля от края колонки до веера руки: `.my-area` (8px) + `.hand` (10px). */
export const HAND_MARGIN = 18;
/** Высота карты к ширине. */
export const CARD_RATIO = 1.5;

/** `transform-origin: 50% 120%` веера руки (table.css): карта поворачивается вокруг точки под собой. */
export const FAN_PIVOT_Y = 1.2;
/** Подъём допустимой карты (`--lift`): поворот уводит его вбок. */
export const FAN_LIFT = 16;
/** Шаг между соседними картами веера и полный разворот (градусы). */
export const FAN_STEP_MAX = 7;
export const FAN_ARC_MAX = 44;

const NATURAL_OVERLAP = 0.35;
/** Плотнее этого рубашки сливаются в одну: из-под верхней всё ещё должен выглядывать край. */
const MAX_OVERLAP = 0.72;

function clampWidth(min: number, vw: number, max: number, viewport: number): number {
  return Math.round(Math.min(max, Math.max(min, viewport * vw)));
}

/** Ширина крупной карты (рука, стол, колода) на экране такой ширины. */
export function bigCardWidth(viewport: number): number {
  return clampWidth(BIG_CARD_MIN, BIG_CARD_VW, BIG_CARD_MAX, viewport);
}

/** Ширина карт соперника (стопка, рубашки, прикуп). */
export function smallCardWidth(viewport: number): number {
  return clampWidth(SMALL_CARD_MIN, SMALL_CARD_VW, SMALL_CARD_MAX, viewport);
}

/** Ширина открытой карты соперника (верх стопки фазы 1). */
export function opponentCardWidth(opponents: number, viewport: number): number {
  return opponents >= CROWDED_FROM ? CROWDED_CARD : smallCardWidth(viewport);
}

/** Ширина рубашки в веере руки соперника и в прикупе. */
export function miniCardWidth(opponents: number, viewport: number): number {
  return opponents >= CROWDED_FROM ? CROWDED_MINI : clampWidth(MINI_CARD_MIN, MINI_CARD_VW, MINI_CARD_MAX, viewport);
}

/** Размер аватарки соперника. */
export function opponentAvatar(opponents: number): number {
  return opponents >= CROWDED_FROM ? AVATAR_CROWDED : AVATAR_ROOMY;
}

/** Сколько ширины есть у веера руки: колонка минус её поля. */
export function handBudget(viewport: number): number {
  return Math.max(BIG_CARD_MIN, Math.min(viewport, COLUMN_MAX) - 2 * HAND_MARGIN);
}

/**
 * Во сколько ширин карты укладывается компактный веер (спека §2c.2). Рука соперника — чуть шире
 * двух с половиной карт, прикуп — полторы: веер читается веером, а не одной картой, и не съедает
 * ширину строки. Числа — доли ширины карты, поэтому не зависят от того, какой она сейчас размер.
 */
export const OPPONENT_FAN_RATIO = 2.6;
export const PRYKUP_FAN_RATIO = 1.6;

/**
 * Перекрытие соседних рубашек в долях ширины карты: N рубашек всегда укладываются в `widthRatio`
 * ширин, но не наезжают друг на друга плотнее естественного перекрытия и не сливаются в одну.
 */
export function overlapFraction(count: number, widthRatio: number): number {
  if (count <= 1) return 0;
  return Math.min(MAX_OVERLAP, Math.max(NATURAL_OVERLAP, (count - widthRatio) / (count - 1)));
}

/** Шаг веера: чем больше карт, тем он мельче, но весь разворот не шире FAN_ARC_MAX. */
export function fanStep(count: number): number {
  return Math.min(FAN_STEP_MAX, FAN_ARC_MAX / Math.max(count, 1));
}

/** Угол i-й карты веера из count. */
export function fanAngle(index: number, count: number): number {
  return (index - (count - 1) / 2) * fanStep(count);
}

/**
 * Насколько повёрнутая карта вылезает вбок за свой столбец веера (px на сторону).
 *
 * Поворот идёт вокруг точки на `FAN_PIVOT_Y` высоты ниже верха карты, поэтому крайние карты
 * не просто наклоняются, а уезжают вбок: половина ширины превращается в
 * `w/2·cos θ + pivot·h·sin θ`, и сверху добавляется подъём `--lift`, который поворот тоже кладёт
 * набок. Без этой поправки бюджет веера считался по неповёрнутым коробкам, и с 7 карт крайние
 * вылезали за экран — страница получала горизонтальную прокрутку (спека §2c.1).
 */
export function rotationBleed(cardWidth: number, angleDeg: number): number {
  const a = (Math.abs(angleDeg) * Math.PI) / 180;
  const half = cardWidth / 2;
  const pivot = FAN_PIVOT_Y * cardWidth * CARD_RATIO;
  return Math.max(0, half * Math.cos(a) + (pivot + FAN_LIFT) * Math.sin(a) - half);
}

/** Перекрытие соседних карт веера (px): N карт всегда влезают в maxWidth, элементов остаётся ровно N. */
export function fanOverlap(count: number, cardWidth: number, maxWidth: number): number {
  if (count <= 1) return 0;
  const natural = cardWidth * NATURAL_OVERLAP;
  const needed = (count * cardWidth - maxWidth) / (count - 1);
  return Math.min(cardWidth - 1, Math.max(natural, needed));
}

export interface FanLayout {
  /** Угловой шаг между соседними картами. */
  step: number;
  /** Перекрытие соседних карт (px). */
  overlap: number;
  /** Запас по краям под поворот крайних карт (px на сторону). */
  bleed: number;
  /** Ширина ряда неповёрнутых карт (px). */
  width: number;
}

/**
 * Раскладка веера руки: сначала считается разворот, из него — запас под поворот, и только остаток
 * бюджета отдаётся под сами карты. Поэтому повёрнутая крайняя карта остаётся внутри бюджета.
 */
export function handFan(count: number, cardWidth: number, budget: number): FanLayout {
  const step = fanStep(count);
  const bleed = rotationBleed(cardWidth, fanAngle(0, count));
  const inner = Math.max(cardWidth, budget - 2 * bleed);
  const overlap = fanOverlap(count, cardWidth, inner);
  return { step, overlap, bleed, width: count * cardWidth - Math.max(0, count - 1) * overlap };
}
