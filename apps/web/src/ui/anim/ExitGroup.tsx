import { AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';
import { useAppStore } from '../../store/appStore';

/** Уходящие карты доигрывают exit; без анимаций — исчезают сразу (инвариант «в покое» проверяется мгновенно). */
export function ExitGroup({ children }: { children: ReactNode }) {
  const enabled = useAppStore((s) => s.motionEnabled);
  if (!enabled) return <>{children}</>;
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}
