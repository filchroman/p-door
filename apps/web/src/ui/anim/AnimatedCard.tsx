import { motion, useReducedMotion, type MotionStyle, type TargetAndTransition } from 'motion/react';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useAppStore } from '../../store/appStore';
import './anim.css';
import { cardMotion, setWillChange } from './motion';

export interface AnimatedCardProps {
  /** Ключ карты (cardKey) — общий layoutId: карта перелетает между зонами как один элемент. */
  id: string;
  className?: string;
  style?: CSSProperties;
  /** Улетать ли при исчезновении (отбой). */
  exit?: boolean;
  /** Карта не летает сама — её несёт контейнер (большой веер руки). */
  still?: boolean;
  children: ReactNode;
}

export function AnimatedCard({ id, className, style, exit = false, still = false, children }: AnimatedCardProps) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const speed = useAppStore((s) => s.animSpeed);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const classes = `animated-card ${className ?? ''}`.trim();
  if (!enabled || still) {
    return (
      <div className={classes} style={style}>
        {children}
      </div>
    );
  }
  const m = cardMotion({ reduced, speed, exit });
  const on = () => setWillChange(ref.current, true);
  const off = () => setWillChange(ref.current, false);
  return (
    <motion.div
      ref={ref}
      layout={m.layoutId}
      layoutId={m.layoutId ? id : undefined}
      className={classes}
      style={style as MotionStyle}
      initial={m.initial as TargetAndTransition}
      animate={m.animate as TargetAndTransition}
      exit={m.exit as TargetAndTransition | undefined}
      transition={m.transition}
      onAnimationStart={on}
      onAnimationComplete={off}
      onLayoutAnimationStart={on}
      onLayoutAnimationComplete={off}
    >
      {children}
    </motion.div>
  );
}
