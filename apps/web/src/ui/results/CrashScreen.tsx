import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import './results.css';

export function CrashScreen() {
  const restart = useAppStore((s) => s.restart);
  return (
    <div className="results-screen">
      <div className="paper-panel results" role="alert">
        <h1 className="script-title">{ru.crash.title}</h1>
        <button type="button" className="btn btn--primary" onClick={restart}>
          {ru.crash.restart}
        </button>
      </div>
    </div>
  );
}
