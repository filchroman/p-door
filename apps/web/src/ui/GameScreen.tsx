import { useAppStore } from '../store/appStore';
import { OutConfetti } from './effects/OutConfetti';
import { VakhtaEffect } from './effects/VakhtaEffect';
import { PenaltyModal } from './table/PenaltyModal';
import { Phase1Screen } from './table/Phase1Screen';
import { Phase2Screen } from './table/Phase2Screen';
import { VakhtaButton } from './table/VakhtaButton';

export function GameScreen() {
  const update = useAppStore((s) => s.update);
  if (!update) return null;
  const { view } = update;
  return (
    <>
      {view.phase === 'phase1' ? <Phase1Screen /> : <Phase2Screen />}
      {view.phase === 'penalty' && view.debts.length > 0 && <PenaltyModal />}
      <VakhtaButton />
      <VakhtaEffect />
      <OutConfetti />
    </>
  );
}
