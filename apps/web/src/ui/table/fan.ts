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

/** Сколько ширины есть у веера руки: колонка минус её поля. */
export function handBudget(viewport: number): number {
  return Math.max(BIG_CARD_MIN, Math.min(viewport, COLUMN_MAX) - 2 * HAND_MARGIN);
}

/**
 * Рука соперника — плотная стопка рубашек: карта остаётся крупной (её видно, когда она прилетает),
 * но веер ужимается почти в одну ширину. Иначе рамка соперника разрастается за 200 px, на экране
 * 375 px соперники встают в столбик, и стол с рукой уезжают за нижний край (спека §2c.1).
 */
export function opponentFanWidth(cardWidth: number): number {
  return Math.round(cardWidth * 0.95);
}

/** Прикуп лежит ещё плотнее: ровно N рубашек, но места занимает меньше одной карты. */
export function prykupFanWidth(cardWidth: number): number {
  return Math.round(cardWidth * 0.8);
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
