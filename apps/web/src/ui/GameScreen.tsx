import { useAppStore } from '../store/appStore';
import { TableScreen } from './table/TableScreen';

export function GameScreen() {
  const update = useAppStore((s) => s.update);
  if (!update) return null;
  return <TableScreen center={null} mine={null} action={null} />;
}
