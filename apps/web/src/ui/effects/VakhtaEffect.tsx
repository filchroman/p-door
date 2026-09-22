import { useAppStore } from '../../store/appStore';
import { isFresh } from '../../store/derive';
import './effects.css';

/** Затемнение стола, вспышка у кнопки и блокировка ввода на 300 мс — ключ seq перезапускает анимацию. */
export function VakhtaEffect() {
  const caught = useAppStore((s) => s.marks.caught);
  if (!caught || !isFresh(caught)) return null;
  return (
    <>
      <div key={`dim-${caught.seq}`} className="fx-dim" aria-hidden="true" />
      <div key={`flash-${caught.seq}`} className="fx-flash" aria-hidden="true" />
      <div key={`block-${caught.seq}`} className="fx-block" aria-hidden="true" />
    </>
  );
}
