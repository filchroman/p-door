import { cardKey, cardLabel } from '../../cards/labels';
import { PlayingCard } from '../../cards/PlayingCard';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { playerName } from '../../store/derive';
import { Countdown } from '../Countdown';
import { zoneProps } from './zones';

export function PenaltyModal() {
  const update = useAppStore((s) => s.update)!;
  const send = useAppStore((s) => s.send);
  const { view, deadlines } = update;
  const debt = view.myDebts[0];
  const fouls = debt ? (view.players.find((p) => p.id === debt.to)?.fouls ?? debt.count) : 0;
  return (
    <div className="modal-backdrop">
      <div className="modal paper-panel" role="dialog" aria-modal="true" aria-labelledby="penalty-title">
        <Countdown endsAt={deadlines.penaltyEndsAt} totalMs={deadlines.penaltyTotalMs} className="modal__timer" />
        <h2 id="penalty-title" className="script-label">
          {ru.penalty.title}
        </h2>
        {debt ? (
          <>
            <p className="modal__text">{ru.penalty.choose(playerName(update, debt.to), fouls, debt.count)}</p>
            <div className="penalty-hand" {...zoneProps(`hand-${view.me}`, view.myHand.length)}>
              {view.myHand.map((card) => (
                <button
                  key={cardKey(card)}
                  type="button"
                  className="penalty-card"
                  aria-label={cardLabel(card)}
                  onClick={() => send({ type: 'givePenalty', to: debt.to, card })}
                >
                  <PlayingCard card={card} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="modal__text">{ru.penalty.waiting}</p>
            <ul className="debtors">
              {view.debts.map((d) => (
                <li key={`${d.from}-${d.to}`}>{ru.penalty.owes(playerName(update, d.from), playerName(update, d.to), d.count)}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
