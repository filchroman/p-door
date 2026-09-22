import type { PlayerId, PublicPlayer } from '@vakhta/engine';
import { ru } from '../../i18n/ru';
import { useAppStore } from '../../store/appStore';
import { DeckArea } from './DeckArea';
import { Pile } from './Pile';
import { TableScreen } from './TableScreen';

export function Phase1Screen() {
  const update = useAppStore((s) => s.update)!;
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);
  const send = useAppStore((s) => s.send);
  const { view } = update;
  const me = view.players.find((p) => p.id === view.me)!;
  const myTurn = view.phase === 'phase1' && view.turn === view.me;
  const canDraw = myTurn && !view.drawn;
  const canMoveTop = myTurn && !view.drawn && me.stackCount >= 2;
  /** Любая стопка — подходящая цель: подсказок «+1» нет. */
  const isPile = (id: string) => view.players.some((p) => p.id === id);

  const placeOn = (to: PlayerId) => {
    if (selection?.kind === 'drawn') send({ type: 'placeDrawn', to });
    if (selection?.kind === 'ownTop') send({ type: 'moveOwnTop', to });
  };

  const pile = (player: PublicPlayer) => (
    <Pile
      player={player}
      targetable={selection !== null}
      onTarget={() => placeOn(player.id)}
      topDraggable={player.id === view.me && canMoveTop}
      topSelected={selection?.kind === 'ownTop'}
      onTopTap={() => select(selection?.kind === 'ownTop' ? null : { kind: 'ownTop' })}
      onTopDrop={(to) => send({ type: 'moveOwnTop', to })}
      accept={isPile}
    />
  );

  return (
    <TableScreen
      opponentExtras={pile}
      center={
        <DeckArea
          count={view.deckCount}
          drawn={view.drawn}
          canDraw={canDraw}
          drawnDraggable={myTurn && view.drawn !== null}
          drawnSelected={selection?.kind === 'drawn'}
          onDraw={() => send({ type: 'draw' })}
          onDrawnTap={() => select(selection?.kind === 'drawn' ? null : { kind: 'drawn' })}
          onDrawnDrop={(to) => send({ type: 'placeDrawn', to })}
          accept={isPile}
        />
      }
      mine={pile(me)}
      action={
        <button type="button" className="btn btn--primary btn--big" disabled={!canDraw} onClick={() => send({ type: 'draw' })}>
          {ru.table.draw}
        </button>
      }
    />
  );
}
