import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useAppStore } from '../../store/appStore';
import './anim.css';
import { FLY_MS } from './motion';
import { zoneOrigin, type Origin } from './origins';

export interface FlyFromProps {
  /** Откуда лететь: имя зоны (обмеряется на появлении) или уже снятая точка. null — не лететь. */
  from: string | Origin | null;
  children: ReactNode;
}

/**
 * Перелёт карты, появившейся на экране впервые: из колоды к вытянутой, из прикупа в руку.
 * Общего `layoutId` тут нет — в источнике лежала рубашка без имени, — поэтому старт считается
 * вручную: в layout-эффекте (до первого кадра, без мигания) и проигрывается CSS-анимацией
 * только по transform; will-change снимается по `animationend` (спека §2a).
 */
export function FlyFrom({ from, children }: FlyFromProps) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const speed = useAppStore((s) => s.animSpeed);
  /** Перелёт — событие появления: меняться по дороге ему нечем. */
  const start = useRef({ from, enabled, speed });
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const { from: source, enabled: on, speed: k } = start.current;
    if (!el || !on || source === null) return;
    const origin = typeof source === 'string' ? zoneOrigin(source) : source;
    if (!origin) return;
    const rect = el.getBoundingClientRect();
    const dx = Math.round(origin.x - rect.left);
    const dy = Math.round(origin.y - rect.top);
    if (dx === 0 && dy === 0) return;
    el.style.setProperty('--fly-x', `${dx}px`);
    el.style.setProperty('--fly-y', `${dy}px`);
    el.style.setProperty('--fly-ms', `${Math.round(FLY_MS / Math.max(1, k))}ms`);
    el.style.willChange = 'transform';
    el.classList.add('is-flying');
    const done = () => {
      el.classList.remove('is-flying');
      el.style.willChange = '';
    };
    el.addEventListener('animationend', done, { once: true });
    return () => {
      el.removeEventListener('animationend', done);
      done();
    };
  }, []);

  return (
    <div ref={ref} className="fly-from">
      {children}
    </div>
  );
}
