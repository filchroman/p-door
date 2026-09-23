import { useState } from 'react';
import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { telegramShare } from '../telegram';
import { Avatar } from './Avatar';
import { MatchForm } from './MatchForm';

/**
 * Лобби: код крупно, «Пригласить» (окно «поделиться» Telegram или буфер обмена), список мест
 * с состоянием связи, настройки (правит хост), «Добить ботами» и «Старт» у хоста.
 */
export function LobbyScreen() {
  const online = useAppStore((s) => s.online);
  const startRoom = useAppStore((s) => s.startRoom);
  const leaveRoom = useAppStore((s) => s.leaveRoom);
  const configureRoom = useAppStore((s) => s.configureRoom);
  const setFillBots = useAppStore((s) => s.setFillBots);
  const invite = useAppStore((s) => s.inviteLink);
  const pushToast = useAppStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);
  const room = online.room;
  if (!room) return null;
  const meId = online.me?.id ?? '';
  const isHost = room.hostId === meId;
  const humans = room.seats.filter((s) => !s.isBot);

  const share = async () => {
    const link = invite();
    if (telegramShare(link, ru.lobby.shareText)) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url: link, text: ru.lobby.shareText });
        return;
      } catch {
        // отменили — предложим скопировать
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      pushToast(ru.lobby.copied);
    } catch {
      pushToast(link);
    }
  };

  return (
    <div className="home-screen lobby">
      <h1 className="script-title">{ru.lobby.title}</h1>
      <div className="paper-panel">
        <div className="lobby__code" aria-label={`${ru.lobby.code}: ${room.code}`}>
          <span className="script-label">{ru.lobby.code}</span>
          <strong className="lobby__code-value" data-testid="room-code">{room.code}</strong>
        </div>
        <button type="button" className="btn btn--primary btn--big lobby__invite" onClick={share}>
          {copied ? ru.lobby.copied : ru.lobby.invite}
        </button>

        <h2 className="script-label">{ru.lobby.seats(humans.length, room.playerCount)}</h2>
        <ul className="seat-list">
          {room.seats.map((seat) => (
            <li key={seat.id} className={`seat-list__item${seat.online ? '' : ' is-offline'}`}>
              <span className="avatar-frame">
                <Avatar value={seat.avatar} />
              </span>
              <span className="seat-list__name">{seat.name}</span>
              {seat.id === room.hostId && <span className="plaque">{ru.lobby.host}</span>}
              {!seat.online && <span className="seat-list__offline">{ru.lobby.offline}</span>}
            </li>
          ))}
        </ul>

        <MatchForm
          value={{ playerCount: room.playerCount, settings: room.settings }}
          disabled={!isHost}
          onChange={(next) => configureRoom(next.settings, next.playerCount)}
        />
        <label className="check">
          <input type="checkbox" checked={room.fillBots} disabled={!isHost} onChange={(e) => setFillBots(e.target.checked)} />
          <span>{ru.lobby.fillBots}</span>
        </label>

        <div className="menu">
          {isHost ? (
            <button type="button" className="btn--play" onClick={startRoom}>
              {ru.lobby.start}
            </button>
          ) : (
            <p className="lobby__waiting" role="status">
              {ru.lobby.waiting}
            </p>
          )}
          <button type="button" className="btn" onClick={leaveRoom}>
            {ru.lobby.leave}
          </button>
        </div>
      </div>
    </div>
  );
}
