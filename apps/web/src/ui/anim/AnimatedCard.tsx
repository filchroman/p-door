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
  /**
   * Перестроение веера несёт контейнер (большой веер руки): карта не обмеряет себя сама.
   * Общий layoutId при этом остаётся — перелёт между зонами (рука ↔ стол) никуда не девается.
   */
  carried?: boolean;
  /** false — появление карты показывает кто-то другой (FlyFrom), своего «падения сверху» тут нет. */
  enter?: boolean;
  children: ReactNode;
}

/**
 * Карта живёт ровно столько, сколько она есть в срезе: ушла из среза — ушла из DOM тем же кадром.
 * Доигрывающих уход карт поверх зоны здесь нет: прерванный уход оставлял их в DOM навсегда
 * (призраки на столе), поэтому отбой рисуется отдельным слоем — см. TableFan.
 */
export function AnimatedCard({ id, className, style, carried = false, enter = true, children }: AnimatedCardProps) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const speed = useAppStore((s) => s.animSpeed);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const classes = `animated-card ${className ?? ''}`.trim();
  if (!enabled) {
    return (
      <div className={classes} style={style}>
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
      layout={m.layoutId && !carried}
      layoutId={m.layoutId ? id : undefined}
      data-layout-id={m.layoutId ? id : undefined}
      className={classes}
      style={style as MotionStyle}
      initial={(enter ? m.initial : m.animate) as TargetAndTransition}
      animate={m.animate as TargetAndTransition}
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
