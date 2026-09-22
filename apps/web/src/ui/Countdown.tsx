import { useMemo, type CSSProperties } from 'react';
import { ru } from '../i18n/ru';

/** Полоска отсчёта: браузер анимирует scaleX сам, React не перерисовывается по таймеру (спека §2a). */
export function Countdown({ endsAt, totalMs, className }: { endsAt: number | null; totalMs: number | null; className?: string }) {
  const remaining = useMemo(() => (endsAt === null ? 0 : Math.max(0, endsAt - Date.now())), [endsAt]);
  if (endsAt === null || !totalMs) return null;
  const style = {
    '--countdown-total': `${totalMs}ms`,
    '--countdown-delay': `${remaining - totalMs}ms`,
  } as CSSProperties;
  return (
    <span className={`countdown ${className ?? ''}`.trim()} role="timer" aria-label={ru.table.seconds(Math.ceil(remaining / 1000))} style={style}>
      <span className="countdown__bar" />
    </span>
  );
}
