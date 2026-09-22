import { useAppStore } from '../store/appStore';
import { OutConfetti } from './effects/OutConfetti';
import { VakhtaEffect } from './effects/VakhtaEffect';
import { CrashScreen } from './results/CrashScreen';
import { GameResults } from './results/GameResults';
import { SessionResults } from './results/SessionResults';
import { PenaltyModal } from './table/PenaltyModal';
import { Phase1Screen } from './table/Phase1Screen';
import { Phase2Screen } from './table/Phase2Screen';
import { VakhtaButton } from './table/VakhtaButton';

export function GameScreen() {
  const update = useAppStore((s) => s.update);
  // Праздничный такт: партия уже кончена, но стол ещё держится, чтобы доиграла лента «Вышел!».
  const celebrating = useAppStore((s) => s.celebrating);
  if (!update || update.session.status === 'crashed') return <CrashScreen />;
  if (update.session.status === 'sessionOver') return <SessionResults />;
  if (update.session.status === 'gameOver' && !celebrating) return <GameResults />;
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
