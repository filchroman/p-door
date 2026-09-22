import type { ErrorCode, StallRule, Suit } from '@vakhta/engine';

/** Русское склонение по числу: plural(2, ['фол', 'фола', 'фолов']) → 'фола'. */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/**
 * Имя в дательном падеже для подписи «переложил Гале» (спека §2c). Ники произвольные, поэтому
 * склоняем только то, что уверенно узнаём: имена на -а/-я и кириллицу на согласную. Остальное
 * оставляем как есть — без падежа читается лучше, чем с выдуманным окончанием.
 */
const CYRILLIC_CONSONANT = /[бвгджзклмнпрстфхцчшщ]$/i;

export function dative(name: string): string {
  if (name.endsWith('ия')) return `${name.slice(0, -1)}и`;
  if (name.endsWith('а') || name.endsWith('я')) return `${name.slice(0, -1)}е`;
  if (name.endsWith('й') || name.endsWith('ь')) return `${name.slice(0, -1)}ю`;
  return CYRILLIC_CONSONANT.test(name) ? `${name}у` : name;
}

const foulsText = (n: number) => `${n} ${plural(n, ['фол', 'фола', 'фолов'])}`;
const cardsText = (n: number) => `${n} ${plural(n, ['карту', 'карты', 'карт'])}`;

const suitNames: Record<Suit, string> = { C: 'хрести', D: 'бубна', H: 'чирва', S: 'пика' };
const stallRules: Record<StallRule, string> = { forcedVidbiy: 'Принудительный отбой', endGame: 'Конец партии' };

export const ru = {
  appTitle: 'Вахта',
  defaultNick: 'Игрок',
  botNames: ['Боря', 'Галя', 'Петрович', 'Люда', 'Семён'],
  humanAvatar: '🧑',
  botAvatars: ['🐻', '🦊', '🐺', '🦉', '🐗'],
  ranks: { 11: 'В', 12: 'Д', 13: 'К', 14: 'Т' } as Record<number, string>,
  suitSymbols: { C: '♣', D: '♦', H: '♥', S: '♠' } as Record<Suit, string>,
  suitNames,
  home: {
    nickLabel: 'Ваше имя',
    players: 'Игроки',
    deck: 'Колода',
    turnTime: 'Время хода',
    stall: 'Затяжной бой',
    turnOff: 'Выкл.',
    seconds: (n: number) => `${n} с`,
    stallRules,
    timerIcon: '⏱',
    timerOffIcon: '∞',
    stallIcons: { forcedVidbiy: '🧹', endGame: '🏁' } as Record<StallRule, string>,
    play: 'Играть ▶',
    loading: 'Тасуем колоду…',
  },
  status: {
    turn: 'Ходит',
    taking: 'Берёт',
    beating: 'Бьёт',
    waiting: 'Ждёт отбоя',
    out: 'Вышел',
    vakhta: 'Вахта!',
    caught: 'Поймал!',
  },
  /** Короткие подписи «кто что сделал» рядом с рамкой игрока (спека §2c). */
  act: {
    drew: 'вытянул',
    kept: 'оставил себе',
    played: 'побил',
    tookBottom: 'взял нижнюю',
    moved: (name: string) => `переложил ${dative(name)}`,
  },
  fx: {
    stamp: 'ВАХТА!',
    foulChip: 'фол',
    outRibbon: 'Вышел!',
    vakhterStamp: 'ВАХТЕР',
  },
  table: {
    deckLabel: (n: number) => `Колода: ${n}`,
    draw: 'Тянуть',
    take: 'Взять нижнюю',
    vakhta: 'ВАХТА!',
    toVidbiy: (k: number, n: number) => `${k}/${n} до отбоя`,
    trump: (suit: Suit) => `Козырь: ${suitNames[suit]}`,
    prykup: (n: number) => `Прикуп: ${n}`,
    stack: (n: number) => `Стопка: ${n}`,
    hand: (n: number) => `Карт: ${n}`,
    tableZone: 'Стол',
    fouls: (n: number) => `Фолы: ${n}`,
    seconds: (n: number) => `${n} с`,
    myHand: 'Моя рука',
  },
  penalty: {
    title: 'Штраф',
    choose: (name: string, fouls: number, count: number) =>
      `${name} получил ${foulsText(fouls)} — выберите ${cardsText(count)} для него`,
    waiting: 'Ждём, пока соперники выберут штрафные карты',
    owes: (from: string, to: string, count: number) => `${from} → ${to}: ${cardsText(count)}`,
  },
  toast: {
    vakhtaFoul: (name: string) => `Вахта! ${name} получил фол`,
    falseAlarm: 'Ложная тревога',
    stall: {
      forcedVidbiy: 'Затяжной бой: принудительный отбой',
      endGame: 'Затяжной бой: партия окончена',
    } as Record<StallRule, string>,
  },
  errors: {
    wrong_phase: 'Сейчас так нельзя',
    not_your_turn: 'Сейчас не ваш ход',
    illegal_move: 'Так нельзя',
    unknown_player: 'Неизвестный игрок',
    card_not_in_hand: 'Этой карты нет в руке',
    nothing_to_call: 'Нарушений не видно',
  } as Record<ErrorCode, string>,
  cannotBeat: 'Так нельзя: этой картой не побить',
  results: {
    title: 'Итоги партии',
    gameNo: (n: number) => `Партия №${n}`,
    loser: (name: string) => `Проиграл: ${name}`,
    draw: 'Ничья',
    prykupUp: 'прикуп +1 в следующей партии',
    losses: 'Поражения за вечер',
    again: 'Ещё партия',
    endEvening: 'Закончить вечер',
    cannotDeal: 'На следующую раздачу не хватит карт — закончите вечер',
    win: 'Победа!',
    youLost: 'Вы — Вахтер этой партии',
  },
  session: {
    title: 'Вахтер вечора',
    nobody: 'Сегодня без проигравших',
    home: 'На главную',
  },
  crash: {
    title: 'Что-то пошло не так',
    restart: 'Начать заново',
  },
  debug: {
    open: 'Отладка',
    title: 'Отладка',
    icon: '🐞',
    playAs: 'Играть за…',
    showHands: 'Показать все руки',
    botSpeed: 'Скорость ботов',
    autopilot: 'Автопилот за меня',
    log: 'Журнал событий',
    speed: (s: number) => `${s}×`,
    fps: 'Кадров/с',
  },
};
