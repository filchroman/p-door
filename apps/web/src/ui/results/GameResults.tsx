import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { Confetti } from '../effects/Confetti';
import { LossTable } from './LossTable';
import './results.css';

export function GameResults() {
  const update = useAppStore((s) => s.update)!;
  const nextGame = useAppStore((s) => s.nextGame);
  const endSession = useAppStore((s) => s.endSession);
  const { view, session, players } = update;
  const loserId = view.result?.loserId ?? null;
  const loser = players.find((p) => p.id === loserId) ?? null;
  const me = players.find((p) => p.id === view.me)!;
  const iLost = loserId === view.me;
  return (
    <div className="results-screen">
      {loser && !iLost && <Confetti burstKey={`win-${session.gameNumber}`} />}
      <div className="paper-panel results">
        <h1 className="script-title">{ru.results.title}</h1>
        <p className="results__game">{ru.results.gameNo(session.gameNumber)}</p>
        {loser === null && <p className="results__draw">{ru.results.draw}</p>}
        {loser && !iLost && (
          <div className="results__hero results__hero--win">
            <span className="avatar-frame avatar-frame--big">
              <span className="avatar" aria-hidden="true">{me.avatar}</span>
            </span>
            <strong className="results__win">{ru.results.win}</strong>
          </div>
        )}
        {iLost && (
          <div className="results__hero results__hero--loss">
            <span className="avatar-frame avatar-frame--big is-sad">
              <span className="avatar" aria-hidden="true">{me.avatar}</span>
              <span className="results__stamp" aria-hidden="true">{ru.fx.vakhterStamp}</span>
            </span>
            <strong>{ru.results.youLost}</strong>
          </div>
        )}
        {loser && (
          <div className="results__loser">
            <span>{ru.results.loser(loser.name)}</span>
            <span className="results__note">{ru.results.prykupUp}</span>
          </div>
        )}
        <LossTable players={players} losses={session.losses} highlight={loserId} />
        {!session.canContinue && <p className="results__warn">{ru.results.cannotDeal}</p>}
        <div className="results__buttons">
          <button type="button" className="btn btn--primary" disabled={!session.canContinue} onClick={nextGame}>
            {ru.results.again}
          </button>
          <button type="button" className="btn" onClick={endSession}>
            {ru.results.endEvening}
          </button>
        </div>
      </div>
    </div>
  );
}
