import { useEffect, useState } from 'react';
import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { isTelegram, telegramProfile } from '../telegram';
import { Avatar } from './Avatar';
import { DEFAULT_MATCH, MatchForm, type MatchFormValue } from './MatchForm';

export const NICK_KEY = 'vakhta.nick';

type Mode = 'menu' | 'create' | 'join' | 'train';

function loadNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveNick(nick: string): void {
  try {
    localStorage.setItem(NICK_KEY, nick);
  } catch {
    // приватный режим — ник просто не запомнится
  }
}

/**
 * Главная: профиль (из Telegram — сразу с фото), «Создать игру», «Войти по коду» и тренировка с
 * ботами. К серверу подключаемся при первом действии, а в Telegram и по ссылке — сразу.
 */
export function HomeScreen() {
  const startMatch = useAppStore((s) => s.startMatch);
  const connect = useAppStore((s) => s.connect);
  const createRoom = useAppStore((s) => s.createRoom);
  const joinRoom = useAppStore((s) => s.joinRoom);
  const online = useAppStore((s) => s.online);
  const [nick, setNick] = useState(loadNick);
  const [mode, setMode] = useState<Mode>('menu');
  const [match, setMatch] = useState<MatchFormValue>(DEFAULT_MATCH);
  const [code, setCode] = useState('');
  const tg = telegramProfile();
  const inTelegram = isTelegram();
  const me = online.me;
  const profileName = me?.name ?? tg?.name ?? (nick.trim() || ru.home.guest);
  const profileAvatar = me?.avatar ?? (tg?.photoUrl || ru.humanAvatar);

  // В Telegram и по ссылке-приглашению соединяемся сразу: имя и место в комнате уже известны.
  useEffect(() => {
    if (!online.client && (inTelegram || online.pendingCode)) connect(nick);
  }, [online.client, online.pendingCode, inTelegram, connect, nick]);

  const ensureConnected = () => {
    saveNick(nick.trim());
    if (!online.client || online.connection === 'lost') connect(nick);
  };

  const create = () => {
    ensureConnected();
    createRoom(match.settings, match.playerCount);
  };

  const join = () => {
    ensureConnected();
    joinRoom(code);
  };

  const train = () => {
    saveNick(nick.trim());
    // Вне Telegram пустой ник даёт «Игрок» (makeSeats); в Telegram за стол садимся под своим именем.
    void startMatch({ nick: nick.trim() || (tg?.name ?? ''), playerCount: match.playerCount, settings: match.settings });
  };

  return (
    <div className="home-screen">
      <h1 className="script-title script-title--huge">{ru.appTitle}</h1>
      <div className="paper-panel">
        <div className="profile" data-testid="profile">
          <span className="avatar-frame">
            <Avatar value={profileAvatar} />
          </span>
          <div className="profile__text">
            <strong className="profile__name">{profileName}</strong>
            {online.connection === 'connecting' && <span className="profile__status">{ru.home.connecting}</span>}
            {online.connection === 'reconnecting' && <span className="profile__status">{ru.lobby.reconnecting}</span>}
            {online.connection === 'lost' && <span className="profile__status is-bad">{ru.home.offline}</span>}
          </div>
        </div>
        {!inTelegram && (
          <label className="field">
            <span className="field__label script-label">{ru.home.nickLabel}</span>
            <input className="field__input" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} />
          </label>
        )}

        {mode === 'menu' && (
          <div className="menu">
            <button type="button" className="btn btn--primary btn--big" onClick={() => setMode('create')}>
              {ru.home.createRoom}
            </button>
            <button type="button" className="btn btn--big" onClick={() => setMode('join')}>
              {ru.home.joinByCode}
            </button>
            <button type="button" className="btn btn--big" onClick={() => setMode('train')}>
              {ru.home.train}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="menu">
            <label className="field">
              <span className="field__label script-label">{ru.home.codeLabel}</span>
              <input className="field__input field__input--code" value={code} maxLength={8} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </label>
            <button type="button" className="btn btn--primary btn--big" disabled={code.trim().length < 3} onClick={join}>
              {ru.home.join}
            </button>
            <button type="button" className="btn" onClick={() => setMode('menu')}>
              {ru.home.back}
            </button>
          </div>
        )}

        {(mode === 'create' || mode === 'train') && (
          <>
            <MatchForm value={match} onChange={setMatch} />
            <div className="menu">
              {mode === 'create' ? (
                <button type="button" className="btn btn--primary btn--big" disabled={online.connection === 'lost'} onClick={create}>
                  {ru.home.create}
                </button>
              ) : (
                <button type="button" className="btn--play" onClick={train}>
                  {ru.home.play}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setMode('menu')}>
                {ru.home.back}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
