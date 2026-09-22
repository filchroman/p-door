import { useAppStore } from '../store/appStore';
import { Phase1Screen } from './table/Phase1Screen';
import { TableScreen } from './table/TableScreen';
import { VakhtaButton } from './table/VakhtaButton';

export function GameScreen() {
  const update = useAppStore((s) => s.update);
  if (!update) return null;
  return (
    <>
      {update.view.phase === 'phase1' ? <Phase1Screen /> : <TableScreen center={null} mine={null} action={null} />}
      <VakhtaButton />
    </>
  );
}
