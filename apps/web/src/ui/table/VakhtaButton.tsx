import { useEffect, useState } from 'react';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { VIBRATE_VAKHTA, vibrate } from '../haptics';

/** Сколько кнопка ещё гаснет после закрытия окна (спека §2c.3: исчезновение — затухание). */
export const VAKHTA_LEAVE_MS = 180;

/**
 * Кнопка «ВАХТА!»: выскакивает с overshoot, пульсирует, пока окно открыто, и гаснет, когда оно
 * закрылось — поэтому после закрытия она живёт ещё VAKHTA_LEAVE_MS в состоянии `is-leaving`.
 */
export function VakhtaButton() {
  const open = useAppStore((s) => s.update?.view.vakhtaOpen ?? false);
  const enabled = useAppStore((s) => s.motionEnabled);
  const send = useAppStore((s) => s.send);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open || !enabled) {
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const timer = setTimeout(() => setLeaving(false), VAKHTA_LEAVE_MS);
    return () => clearTimeout(timer);
  }, [open, enabled]);
  if (!open && !leaving) return null;
  return (
    <button
      type="button"
      className={`vakhta-btn${open ? '' : ' is-leaving'}`}
      disabled={!open}
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
