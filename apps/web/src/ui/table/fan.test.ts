import { describe, expect, it } from 'vitest';
import {
  BIG_CARD_MAX,
  BIG_CARD_MIN,
  CARD_RATIO,
  FAN_LIFT,
  FAN_PIVOT_Y,
  SMALL_CARD_MIN,
  bigCardWidth,
  fanAngle,
  fanOverlap,
  handBudget,
  handFan,
  rotationBleed,
  smallCardWidth,
} from './fan';

/**
 * Честная коробка повёрнутой карты: `transform: rotate(a) translateY(-lift)` вокруг точки
 * `50% (FAN_PIVOT_Y * 100)%`, как в table.css. Считается корнями, а не через rotationBleed —
 * иначе тест сошёлся бы сам с собой.
 */
function rotatedSpan(left: number, width: number, angleDeg: number, lift: number): [number, number] {
  const height = width * CARD_RATIO;
  const a = (angleDeg * Math.PI) / 180;
  const ox = left + width / 2;
  const oy = FAN_PIVOT_Y * height;
  const xs: number[] = [];
  for (const px of [left, left + width]) {
    for (const py of [0, height]) {
      xs.push(ox + (px - ox) * Math.cos(a) - (py - oy - lift) * Math.sin(a));
    }
  }
  return [Math.min(...xs), Math.max(...xs)];
}

/** Ряд веера центрируется в бюджете, каждая следующая карта сдвинута на (ширина − перекрытие). */
function handSpans(count: number, viewport: number, lift: number): { left: number; right: number } {
  const cardWidth = bigCardWidth(viewport);
  const budget = handBudget(viewport);
  const fan = handFan(count, cardWidth, budget);
  const start = (budget - fan.width) / 2;
  let left = Infinity;
  let right = -Infinity;
  for (let i = 0; i < count; i++) {
    const [lo, hi] = rotatedSpan(start + i * (cardWidth - fan.overlap), cardWidth, fanAngle(i, count), lift);
    left = Math.min(left, lo);
    right = Math.max(right, hi);
  }
  return { left, right };
}

describe('размеры карт (§2c.1)', () => {
  it('своя рука и стол — не меньше 84 px на телефоне', () => {
    expect(bigCardWidth(320)).toBe(BIG_CARD_MIN);
    expect(bigCardWidth(375)).toBe(BIG_CARD_MIN);
    expect(bigCardWidth(414)).toBeGreaterThanOrEqual(BIG_CARD_MIN);
    expect(bigCardWidth(1440)).toBe(BIG_CARD_MAX);
  });

  it('стопки и рубашки соперников — не меньше 64 px', () => {
    for (const viewport of [320, 375, 414, 768, 1440]) {
      expect(smallCardWidth(viewport)).toBeGreaterThanOrEqual(SMALL_CARD_MIN);
    }
  });

  it('растр 240 px покрывает удвоенный максимальный экранный размер', () => {
    expect(BIG_CARD_MAX * 2).toBeLessThanOrEqual(240);
  });
});

describe('веер руки не вылезает за экран (§2c.1)', () => {
  it('поворот вокруг точки под картой уводит её вбок, и это учтено', () => {
    expect(rotationBleed(84, 0)).toBe(0);
    expect(rotationBleed(84, 20)).toBeGreaterThan(rotationBleed(84, 10));
    // Ровно геометрия: w/2·cos + (pivot·h + lift)·sin − w/2.
    const a = (20 * Math.PI) / 180;
    expect(rotationBleed(84, 20)).toBeCloseTo(42 * Math.cos(a) + (FAN_PIVOT_Y * 126 + FAN_LIFT) * Math.sin(a) - 42, 6);
  });

  it('бюджет карт меньше бюджета веера ровно на запас под поворот', () => {
    const fan = handFan(10, 84, 339);
    expect(fan.bleed).toBeGreaterThan(0);
    expect(fan.width).toBeLessThanOrEqual(339 - 2 * fan.bleed + 0.001);
  });

  for (const viewport of [320, 375, 414, 480, 1024]) {
    it(`коробка крайней карты остаётся внутри бюджета при 2…30 картах (${viewport} px)`, () => {
      const budget = handBudget(viewport);
      for (let count = 2; count <= 30; count++) {
        for (const lift of [0, FAN_LIFT]) {
          const { left, right } = handSpans(count, viewport, lift);
          expect(left, `${count} карт, подъём ${lift}: левый край ${left.toFixed(1)}`).toBeGreaterThanOrEqual(-0.5);
          expect(right, `${count} карт, подъём ${lift}: правый край ${right.toFixed(1)} при бюджете ${budget}`).toBeLessThanOrEqual(
            budget + 0.5,
          );
        }
      }
    });
  }

  it('без поправки на поворот (старый расчёт) карты действительно вылезали — регрессия', () => {
    const viewport = 375;
    const cardWidth = bigCardWidth(viewport);
    const budget = handBudget(viewport);
    const naive = fanOverlap(7, cardWidth, budget);
    const start = (budget - (7 * cardWidth - 6 * naive)) / 2;
    const [, right] = rotatedSpan(start + 6 * (cardWidth - naive), cardWidth, fanAngle(6, 7), FAN_LIFT);
    expect(right).toBeGreaterThan(budget);
  });

  it('элементов в веере всегда ровно N: перекрытие не больше ширины карты', () => {
    for (let count = 2; count <= 30; count++) {
      const fan = handFan(count, 84, handBudget(375));
      expect(fan.overlap).toBeLessThanOrEqual(83);
      expect(fan.overlap).toBeGreaterThanOrEqual(0);
    }
  });
});
