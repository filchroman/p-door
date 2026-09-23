import type { DeckSize, StallRule } from '@vakhta/engine';
import { TURN_SECONDS, type MatchSettings, type TurnSeconds } from '../client/types';
import { ru } from '../i18n/ru';
import { Segmented } from './Segmented';

const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const DECK_SIZES: DeckSize[] = [36, 52];
const STALL_RULES: StallRule[] = ['forcedVidbiy', 'endGame'];

export interface MatchFormValue {
  playerCount: number;
  settings: MatchSettings;
}

export const DEFAULT_MATCH: MatchFormValue = { playerCount: 3, settings: { deckSize: 36, turnSeconds: 30, stallRule: 'forcedVidbiy' } };

/** Настройки партии: игроки, колода, время хода, затяжной бой. Общий для тренировки и комнаты. */
export function MatchForm({ value, onChange, disabled = false }: { value: MatchFormValue; onChange(next: MatchFormValue): void; disabled?: boolean }) {
  const set = (patch: Partial<MatchSettings>) => onChange({ ...value, settings: { ...value.settings, ...patch } });
  return (
    <fieldset className="match-form" disabled={disabled}>
      <h2 className="script-label">{ru.home.players}</h2>
      <Segmented
        label={ru.home.players}
        value={value.playerCount}
        options={PLAYER_COUNTS.map((n) => ({ value: n, label: String(n) }))}
        onChange={(playerCount) => onChange({ ...value, playerCount })}
      />
      <h2 className="script-label">{ru.home.deck}</h2>
      <Segmented label={ru.home.deck} value={value.settings.deckSize} options={DECK_SIZES.map((n) => ({ value: n, label: String(n) }))} onChange={(deckSize) => set({ deckSize })} />
      <h2 className="script-label">{ru.home.turnTime}</h2>
      <Segmented
        variant="tiles"
        label={ru.home.turnTime}
        value={value.settings.turnSeconds}
        options={TURN_SECONDS.map((s: TurnSeconds) => ({
          value: s,
          label: s === 0 ? ru.home.turnOff : ru.home.seconds(s),
          icon: s === 0 ? ru.home.timerOffIcon : ru.home.timerIcon,
        }))}
        onChange={(turnSeconds) => set({ turnSeconds })}
      />
      <h2 className="script-label">{ru.home.stall}</h2>
      <Segmented
        variant="tiles"
        label={ru.home.stall}
        value={value.settings.stallRule}
        options={STALL_RULES.map((rule) => ({ value: rule, label: ru.home.stallRules[rule], icon: ru.home.stallIcons[rule] }))}
        onChange={(stallRule) => set({ stallRule })}
      />
    </fieldset>
  );
}
