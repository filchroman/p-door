import { motion } from 'motion/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useAppStore } from '../../store/appStore';
import { FLY_MS } from './motion';

export interface AnimatedGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** true — контейнер двигается одной трансформацией вместо N отдельных карт. */
  animate: boolean;
  children: ReactNode;
}

export function AnimatedGroup({ animate, children, ...rest }: AnimatedGroupProps) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const speed = useAppStore((s) => s.animSpeed);
  if (!animate || !enabled) return <div {...rest}>{children}</div>;
  const { onAnimationStart: _a, onDrag: _d, onDragStart: _ds, onDragEnd: _de, ...safe } = rest;
  return (
    <motion.div layout transition={{ duration: FLY_MS / 1000 / Math.max(1, speed), ease: 'easeOut' }} {...safe}>
      {children}
    </motion.div>
  );
}
