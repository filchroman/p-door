import { motion, useReducedMotion, type TargetAndTransition } from 'motion/react';
import type { ReactNode } from 'react';
import { PlayingCard } from '../../cards/PlayingCard';
import { useAppStore } from '../../store/appStore';
import './anim.css';
import { flipMotion } from './motion';

/** Появление рубашкой вверх с переворотом: открытие прикупа, вытянутая и козырная карта. */
export function FlipIn({ flip, children }: { flip: boolean; children: ReactNode }) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const speed = useAppStore((s) => s.animSpeed);
  const reduced = useReducedMotion() ?? false;
  if (!flip || !enabled) return <>{children}</>;
  const m = flipMotion({ reduced, speed });
  if (m.reduced) {
    return (
      <motion.div initial={m.initial as TargetAndTransition} animate={m.animate as TargetAndTransition} transition={m.transition}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className="flip-in"
      initial={m.initial as TargetAndTransition}
      animate={m.animate as TargetAndTransition}
      transition={m.transition}
    >
      <div className="flip-in__front">{children}</div>
      <div className="flip-in__back" aria-hidden="true">
        <PlayingCard card={null} />
      </div>
    </motion.div>
  );
}
