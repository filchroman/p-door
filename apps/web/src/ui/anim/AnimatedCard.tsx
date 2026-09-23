import { motion, useReducedMotion, type MotionStyle, type TargetAndTransition } from 'motion/react';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useAppStore } from '../../store/appStore';
import './anim.css';
import { cardMotion, setWillChange } from './motion';

export interface AnimatedCardProps {
  /** Ключ карты (cardKey): по `data-card` перелёт находит место карты на прошлом кадре (flights.ts). */
  id: string;
  className?: string;
  style?: CSSProperties;
  /** false — появление карты показывает кто-то другой (FlyFrom), своего «падения сверху» тут нет. */
  enter?: boolean;
  children: ReactNode;
}

/**
 * Карта живёт ровно столько, сколько она есть в срезе: ушла из среза — ушла из DOM тем же кадром.
 * Перелёты между зонами играет FlyFrom по снятым коробкам; общего layoutId здесь больше нет —
 * он вторично «довозил» карту, которую игрок уже перетащил сам. Отбой — отдельный слой (TableFan).
 */
export function AnimatedCard({ id, className, style, enter = true, children }: AnimatedCardProps) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const speed = useAppStore((s) => s.animSpeed);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const classes = `animated-card ${className ?? ''}`.trim();
  // data-card стоит всегда: по нему перелёт находит место карты на прошлом кадре (flights.ts).
  if (!enabled) {
    return (
      <div className={classes} style={style} data-card={id}>
        {children}
      </div>
    );
  }
  const m = cardMotion({ reduced, speed });
  const on = () => setWillChange(ref.current, true);
  const off = () => setWillChange(ref.current, false);
  return (
    <motion.div
      ref={ref}
      data-card={id}
      className={classes}
      style={style as MotionStyle}
      initial={(enter ? m.initial : m.animate) as TargetAndTransition}
      animate={m.animate as TargetAndTransition}
      transition={m.transition}
      onAnimationStart={on}
      onAnimationComplete={off}
    >
      {children}
    </motion.div>
  );
}
