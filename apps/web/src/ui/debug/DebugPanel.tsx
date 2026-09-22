import { useShallow } from 'zustand/react/shallow';
import { BOT_SPEEDS } from '../../host/types';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { Segmented } from '../Segmented';
import './debug.css';
import { formatLogEntry } from './formatLog';
import { FpsMeter } from './FpsMeter';

const LOG_LINES = 100;

export function DebugPanel() {
  const { debug, me, players, log, toggleDebug, setShowAllHands, setBotSpeed, setAutopilot, playAs } = useAppStore(
    useShallow((s) => ({
      debug: s.debug,
      me: s.update?.view.me ?? null,
      players: s.update?.players ?? null,
      log: s.debug.open ? s.log : null,
      toggleDebug: s.toggleDebug,
      setShowAllHands: s.setShowAllHands,
      setBotSpeed: s.setBotSpeed,
      setAutopilot: s.setAutopilot,
      playAs: s.playAs,
    })),
  );

  return (
    <>
      <button type="button" className="debug-toggle" aria-label={ru.debug.open} aria-expanded={debug.open} onClick={toggleDebug}>
        {ru.debug.icon}
      </button>
      {debug.open && (
        <aside className="debug-panel" aria-label={ru.debug.title}>
          <h2>{ru.debug.title}</h2>
          <p className="fps-line">
            {ru.debug.fps}: <FpsMeter />
          </p>
          {me && players && (
            <>
              <h3>{ru.debug.playAs}</h3>
              <Segmented label={ru.debug.playAs} value={me} options={players.map((p) => ({ value: p.id, label: p.name }))} onChange={playAs} />
            </>
          )}
          <label className="check">
            <input type="checkbox" checked={debug.showAllHands} onChange={(e) => setShowAllHands(e.target.checked)} />
            {ru.debug.showHands}
          </label>
          <h3>{ru.debug.botSpeed}</h3>
          <Segmented
            label={ru.debug.botSpeed}
            value={debug.botSpeed}
            options={BOT_SPEEDS.map((speed) => ({ value: speed, label: ru.debug.speed(speed) }))}
            onChange={setBotSpeed}
          />
          <label className="check">
            <input type="checkbox" checked={debug.autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
            {ru.debug.autopilot}
          </label>
          <h3>{ru.debug.log}</h3>
          <ol className="debug-log">
            {(log ?? [])
              .slice(-LOG_LINES)
              .reverse()
              .map((entry, i) => (
                <li key={`${entry.at}-${i}`}>{formatLogEntry(entry)}</li>
              ))}
          </ol>
        </aside>
      )}
    </>
  );
}
