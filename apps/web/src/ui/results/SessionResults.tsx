import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { Confetti } from '../effects/Confetti';
import { LossTable } from './LossTable';
import './results.css';

export function SessionResults() {
  const update = useAppStore((s) => s.update)!;
  const goHome = useAppStore((s) => s.goHome);
  const { session, players } = update;
  const vakhter = players.find((p) => p.id === session.vakhterId) ?? null;
  return (
    <div className="results-screen">
      {vakhter && <Confetti burstKey="vakhter" durationMs={3000} count={150} />}
      <div className="paper-panel results">
        <h1 className="script-title script-title--huge">{ru.session.title}</h1>
        {vakhter ? (
          <div className="vakhter">
            <span className="vakhter__crown" aria-hidden="true">👑</span>
            <span className="avatar-frame avatar-frame--big">
              <span className="avatar" aria-hidden="true">{vakhter.avatar}</span>
            </span>
            <strong className="vakhter__name">{vakhter.name}</strong>
          </div>
        ) : (
          <p>{ru.session.nobody}</p>
        )}
        <LossTable players={players} losses={session.losses} highlight={session.vakhterId} />
        <button type="button" className="btn btn--primary" onClick={goHome}>
          {ru.session.home}
        </button>
      </div>
    </div>
  );
}
