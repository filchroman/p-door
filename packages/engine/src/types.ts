import type { Card, DeckSize, Suit } from './cards';

export type PlayerId = string;
export type Phase = 'phase1' | 'penalty' | 'phase2' | 'over';
export type StallRule = 'forcedVidbiy' | 'endGame';

export interface PlayerState {
  id: PlayerId;
  prykup: Card[];
  stack: Card[]; // фаза 1, верх — последний элемент
  hand: Card[]; // штраф и фаза 2
  fouls: number;
  out: boolean;
}

/** Окно Вахты, открывается на каждом draw и на каждом «забрал себе». */
export interface Watch {
  id: number;
  playerId: PlayerId;
  at: number;
  violated: boolean;
  called: boolean;
  othersActed: boolean;
}

export interface PenaltyDebt {
  from: PlayerId;
  to: PlayerId;
  count: number;
}

export interface TableCard {
  card: Card;
  by: PlayerId;
}

export interface GameResult {
  loserId: PlayerId | null; // null — ничья
  winnerId: PlayerId | null;
  outOrder: PlayerId[];
  technical: boolean;
}

export interface GameState {
  deckSize: DeckSize;
  players: PlayerState[]; // порядок мест по часовой
  phase: Phase;
  turn: PlayerId;
  deck: Card[]; // тянем с индекса 0
  drawn: Card | null;
  drawHistory: Card[];
  openDeal: Card[];
  trump: Suit | null;
  lastCardDrawerId: PlayerId | null;
  previousWinnerId: PlayerId | null;
  watches: Watch[];
  nextWatchId: number;
  debts: PenaltyDebt[];
  table: TableCard[]; // индекс 0 — нижняя карта
  discard: Card[];
  outOrder: PlayerId[];
  result: GameResult | null;
  stallRule: StallRule;
  quietActions: number; // подряд идущие действия фазы 2 без побития
  idleActions: number; // подряд идущие действия фазы 2 без прогресса
}

export type Action =
  | { type: 'moveOwnTop'; to: PlayerId }
  | { type: 'draw' }
  | { type: 'placeDrawn'; to: PlayerId }
  | { type: 'callVakhta' }
  | { type: 'givePenalty'; to: PlayerId; card: Card }
  | { type: 'play'; card: Card }
  | { type: 'take' }
  | { type: 'surrender' }
  | { type: 'tick' };

export type GameEvent =
  | { type: 'drew'; playerId: PlayerId; card: Card }
  | { type: 'placed'; playerId: PlayerId; to: PlayerId; card: Card }
  | { type: 'movedTop'; from: PlayerId; to: PlayerId; card: Card }
  | { type: 'kept'; playerId: PlayerId; card: Card }
  | { type: 'vakhta'; callerId: PlayerId; fouled: PlayerId[] }
  | { type: 'trump'; suit: Suit; card: Card }
  | { type: 'phase'; phase: Phase }
  | { type: 'penaltyGiven'; from: PlayerId; to: PlayerId }
  | { type: 'played'; playerId: PlayerId; card: Card }
  | { type: 'tookBottom'; playerId: PlayerId; card: Card }
  | { type: 'vidbiy'; closerId: PlayerId }
  | { type: 'prykupOpened'; playerId: PlayerId }
  | { type: 'out'; playerId: PlayerId }
  | { type: 'gameOver'; result: GameResult }
  | { type: 'stall'; rule: StallRule };

export type ErrorCode =
  | 'wrong_phase'
  | 'not_your_turn'
  | 'illegal_move'
  | 'unknown_player'
  | 'card_not_in_hand'
  | 'nothing_to_call';

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ErrorCode };
