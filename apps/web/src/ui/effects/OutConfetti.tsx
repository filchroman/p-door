import { useAppStore } from '../../store/appStore';
import { isFresh } from '../../store/derive';
import { Confetti } from './Confetti';

/** Небольшой взрыв конфетти, когда из партии вышел я. */
export function OutConfetti() {
  const mine = useAppStore((s) => (s.update ? s.marks.outFx[s.update.view.me] : undefined));
  if (!mine || !isFresh(mine)) return null;
  return <Confetti burstKey={mine.seq} count={80} durationMs={1600} />;
}
