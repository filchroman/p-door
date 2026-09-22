import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { PlayingCard } from '../../cards/PlayingCard';
import { useAppStore } from '../../store/appStore';
import './anim.css';
import { FADE_MS, FLY_MS } from './motion';

/** Появление рубашкой вверх с переворотом: открытие прикупа, вытянутая и козырная карта. */
export function FlipIn({ flip, children }: { flip: boolean; children: ReactNode }) {
  const enabled = useAppStore((s) => s.motionEnabled);
  const reduced = useReducedMotion() ?? false;
  if (!flip || !enabled) return <>{children}</>;
  if (reduced) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: FADE_MS / 1000 }}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div className="flip-in" initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: FLY_MS / 1000, ease: 'easeOut' }}>
      <div className="flip-in__front">{children}</div>
      <div className="flip-in__back" aria-hidden="true">
        <PlayingCard card={null} />
      </div>
    </motion.div>
  );
}
