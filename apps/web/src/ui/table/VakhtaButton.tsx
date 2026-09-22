import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { VIBRATE_VAKHTA, vibrate } from '../haptics';

export function VakhtaButton() {
  const open = useAppStore((s) => s.update?.view.vakhtaOpen ?? false);
  const send = useAppStore((s) => s.send);
  if (!open) return null;
  return (
    <button
      type="button"
      className="vakhta-btn"
      onClick={(e) => {
        e.stopPropagation();
        vibrate(VIBRATE_VAKHTA);
        send({ type: 'callVakhta' });
      }}
    >
      {ru.table.vakhta}
    </button>
  );
}
