import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { Hand } from './Hand';
import { legalFromView } from './legal';
import { OpponentHand } from './OpponentHand';
import { TableFan } from './TableFan';
import { TableScreen } from './TableScreen';

/** Стол после фазы 1: и штраф (руки уже закрыты), и бой. */
export function Phase2Screen() {
  const update = useAppStore((s) => s.update)!;
  const allHands = useAppStore((s) => s.allHands);
  const send = useAppStore((s) => s.send);
  const { view } = update;
  const legal = legalFromView(view);
  const handInModal = view.phase === 'penalty' && view.myDebts.length > 0;
  return (
    <TableScreen
      opponentExtras={(p) => <OpponentHand player={p} cards={allHands?.[p.id] ?? null} />}
      center={<TableFan table={view.table} />}
      mine={!handInModal && <Hand />}
      action={
        <button type="button" className="btn btn--primary btn--big" disabled={!legal.canTake} onClick={() => send({ type: 'take' })}>
          {ru.table.take}
        </button>
      }
    />
  );
}
