import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/appStore';
import './anim.css';
import { flyMs } from './motion';
import { zoneOrigin, type Origin } from './origins';

export interface FlyFromProps {
  /** Откуда лететь: имя зоны (обмеряется на появлении) или уже снятая коробка. null — не лететь. */
  from: string | Origin | null;
  /**
   * Что именно летит в верхнем слое — тот же вид карты, что ляжет в приёмнике. Отдельный узел, а не
   * `children`: приёмник остаётся на месте (скрытым), а летит его копия без обработчиков.
   */
  ghost: ReactNode;
  /** Задержка старта (каскад карт прикупа, спека §2c.3); приёмник скрыт и всё время ожидания. */
  delayMs?: number;
  /** Обёртка перелёта — она же позиционируемый элемент зоны (карта стола, карта веера). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Коробка перелёта в координатах окна: где приземлиться и на сколько сдвинуться к источнику. */
interface FlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
  /** Во сколько раз карта была меньше (стопка соперника) или больше (стол) в источнике. */
  scale: number;
  ms: number;
  delay: number;
}

/** Во сколько раз карте позволено вырасти или уменьшиться за перелёт: дальше это уже не карта. */
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
/** Запас на случай, если `animationend` не пришёл (вкладка ушла в фон) — приёмник не останется скрытым. */
const RELEASE_SLACK_MS = 150;

let layerEl: HTMLDivElement | null = null;

/**
 * Верхний слой перелётов — портал в конец `body` (спека §2c.2). Он вне игровой колонки, а значит
 * вне её `overflow-x: clip`, вне `perspective` стола и веера и вне поворота карты руки: летящая
 * карта не обрезается, её координаты — честные координаты окна, и она лежит поверх стола и рамок.
 * В зонах слоя нет, поэтому инвариант «в покое» его не считает.
 */
export function flightLayer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (!layerEl || !layerEl.isConnected) {
    layerEl = document.createElement('div');
    layerEl.className = 'flight-layer';
    layerEl.setAttribute('aria-hidden', 'true');
    document.body.append(layerEl);
  }
  return layerEl;
}

/**
 * Перелёт карты, появившейся в зоне: из колоды к вытянутой, со стопки на стопку, из руки на стол.
 * Общего `layoutId` тут нет — в источнике лежала рубашка без имени, — поэтому старт считается
 * вручную в layout-эффекте (до первого кадра, без мигания), а сам полёт идёт в верхнем слое.
 * Приёмник на это время прячется (`visibility`), поэтому карты не видно в двух местах; в DOM он
 * остаётся, и счёт карт в зоне не меняется. Анимируются только transform и opacity (§2a).
 */
export function FlyFrom({ from, ghost, delayMs = 0, className, style, children }: FlyFromProps) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const speed = useAppStore((s) => s.animSpeed);
  /** Перелёт — событие появления: меняться по дороге ему нечем. */
  const start = useRef({ from, enabled, speed, delayMs });
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<FlightBox | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const { from: source, enabled: on, speed: k, delayMs: delay } = start.current;
    if (!el || !on || source === null) return;
    const origin = typeof source === 'string' ? zoneOrigin(source) : source;
    if (!origin) return;
    const rect = el.getBoundingClientRect();
    // Размер берётся до поворота (карта веера наклонена), а место — по видимому центру коробки.
    const width = el.offsetWidth || rect.width;
    const height = el.offsetHeight || rect.height;
    const left = rect.left + rect.width / 2 - width / 2;
    const top = rect.top + rect.height / 2 - height / 2;
    const dx = Math.round(origin.x + origin.w / 2 - (left + width / 2));
    const dy = Math.round(origin.y + origin.h / 2 - (top + height / 2));
    if (dx === 0 && dy === 0) return;
    const scale = width > 0 && origin.w > 0 ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, origin.w / width)) : 1;
    setBox({ left, top, width, height, dx, dy, scale, ms: flyMs(k), delay: Math.round(delay / Math.max(1, k)) });
  }, []);

  useEffect(() => {
    if (!box) return;
    const timer = setTimeout(() => setBox(null), box.delay + box.ms + RELEASE_SLACK_MS);
    return () => clearTimeout(timer);
  }, [box]);

  const layer = box ? flightLayer() : null;
  const classes = ['fly-from', box ? 'is-away' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <>
      <div ref={ref} className={classes} style={style}>
        {children}
      </div>
      {box &&
        layer &&
        createPortal(
          <div
            className="flight-card"
            data-flight="card"
            style={
              {
                left: `${Math.round(box.left)}px`,
                top: `${Math.round(box.top)}px`,
                width: `${Math.round(box.width)}px`,
                height: `${Math.round(box.height)}px`,
                '--card-w': `${Math.round(box.width)}px`,
                '--fly-x': `${box.dx}px`,
                '--fly-y': `${box.dy}px`,
                '--fly-s': box.scale,
                '--fly-ms': `${box.ms}ms`,
                '--fly-delay': `${box.delay}ms`,
              } as CSSProperties
            }
            onAnimationEnd={() => setBox(null)}
          >
            {ghost}
          </div>,
          layer,
        )}
    </>
  );
}
