import type { DeckSize, StallRule } from '@vakhta/engine';
import { useState } from 'react';
import { TURN_SECONDS, type TurnSeconds } from '../client/types';
import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { Segmented } from './Segmented';

export const NICK_KEY = 'vakhta.nick';

const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const DECK_SIZES: DeckSize[] = [36, 52];
const STALL_RULES: StallRule[] = ['forcedVidbiy', 'endGame'];

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

export function HomeScreen() {
  const startMatch = useAppStore((s) => s.startMatch);
  const [nick, setNick] = useState(loadNick);
  const [playerCount, setPlayerCount] = useState(3);
  const [deckSize, setDeckSize] = useState<DeckSize>(36);
  const [turnSeconds, setTurnSeconds] = useState<TurnSeconds>(30);
  const [stallRule, setStallRule] = useState<StallRule>('forcedVidbiy');

  const play = () => {
    const trimmed = nick.trim();
    saveNick(trimmed);
    void startMatch({ nick: trimmed, playerCount, settings: { deckSize, turnSeconds, stallRule } });
  };

  return (
    <div className="home-screen">
      <h1 className="script-title script-title--huge">{ru.appTitle}</h1>
      <div className="paper-panel">
        <label className="field">
          <span className="field__label script-label">{ru.home.nickLabel}</span>
          <input className="field__input" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} />
        </label>

        <h2 className="script-label">{ru.home.players}</h2>
        <Segmented
          label={ru.home.players}
          value={playerCount}
          options={PLAYER_COUNTS.map((n) => ({ value: n, label: String(n) }))}
          onChange={setPlayerCount}
        />

        <h2 className="script-label">{ru.home.deck}</h2>
        <Segmented
          label={ru.home.deck}
          value={deckSize}
          options={DECK_SIZES.map((n) => ({ value: n, label: String(n) }))}
          onChange={setDeckSize}
        />

        <h2 className="script-label">{ru.home.turnTime}</h2>
        <Segmented
          variant="tiles"
          label={ru.home.turnTime}
          value={turnSeconds}
          options={TURN_SECONDS.map((s) => ({
            value: s,
            label: s === 0 ? ru.home.turnOff : ru.home.seconds(s),
            icon: s === 0 ? ru.home.timerOffIcon : ru.home.timerIcon,
          }))}
          onChange={setTurnSeconds}
        />

        <h2 className="script-label">{ru.home.stall}</h2>
        <Segmented
          variant="tiles"
          label={ru.home.stall}
          value={stallRule}
          options={STALL_RULES.map((rule) => ({ value: rule, label: ru.home.stallRules[rule], icon: ru.home.stallIcons[rule] }))}
          onChange={setStallRule}
        />
      </div>
      <button type="button" className="btn--play" onClick={play}>
        {ru.home.play}
      </button>
    </div>
  );
}
