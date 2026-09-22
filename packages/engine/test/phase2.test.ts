import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { legalMoves } from '../src/legal';
import { fnv1a, positionHash, positionKey } from '../src/phase2';
import type { Action, GameEvent, GameState, StallRule } from '../src/types';
import { act, c, cs, phase2State, pl } from './helpers';

// Козырь — бубна. Места: A → B → C → A.
describe('phase 2: beating and taking', () => {
  it('any card leads on an empty table', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '7S 9C' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A' }), 'A', { type: 'play', card: c('7S') });
    expect(s.table).toEqual([{ card: c('7S'), by: 'A' }]);
    expect(s.turn).toBe('B');
  });

  it('beating follows combat rules', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '7C' }, { id: 'B', hand: 'JH 8H 6D AS' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'B', table: [['9H', 'A']] });
    expect(apply(s, 'B', { type: 'play', card: c('8H') }, 0)).toEqual({ ok: false, error: 'illegal_move' });
    expect(apply(s, 'B', { type: 'play', card: c('AS') }, 0)).toEqual({ ok: false, error: 'illegal_move' });
    expect(apply(s, 'B', { type: 'play', card: c('QC') }, 0)).toEqual({ ok: false, error: 'card_not_in_hand' });
    expect(act(s, 'B', { type: 'play', card: c('6D') }).turn).toBe('C');
    const s2 = act(s, 'B', { type: 'play', card: c('JH') });
    expect(s2.table.map((t) => t.card)).toEqual(cs('9H JH'));
  });

  it('take moves the bottom card to hand; next player beats the same top', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] }), 'C', { type: 'take' });
    expect(pl(s, 'C').hand).toEqual(cs('KC 7H'));
    expect(s.table.map((t) => t.card)).toEqual(cs('9H'));
    expect(s.turn).toBe('A');
  });

  it('take is always allowed on a non-empty table and forbidden on an empty one', () => {
    const empty = phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }], trump: 'D', turn: 'A' });
    expect(apply(empty, 'A', { type: 'take' }, 0)).toEqual({ ok: false, error: 'illegal_move' });
  });

  it('table emptied by takes: the next player leads with any card', () => {
    let s = phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }, { id: 'C', hand: 'KC 6S' }], trump: 'D', turn: 'B', table: [['7H', 'A']] });
    s = act(s, 'B', { type: 'take' });
    expect(s.table).toEqual([]);
    expect(s.turn).toBe('C');
    s = act(s, 'C', { type: 'play', card: c('6S') });
    expect(s.turn).toBe('A');
  });

  it('players who are out are skipped', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '', out: true }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A' }), 'A', { type: 'play', card: c('QH') });
    expect(s.turn).toBe('C');
  });

  it('rejects out-of-turn and phase-1 actions', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'QH' }, { id: 'B', hand: '8C' }], trump: 'D', turn: 'A' });
    expect(apply(s, 'B', { type: 'play', card: c('8C') }, 0)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(apply(s, 'A', { type: 'draw' }, 0)).toEqual({ ok: false, error: 'wrong_phase' });
  });
});

describe('phase 2: vidbiy, prykup, exit', () => {
  it('vidbiy clears the table when it holds as many cards as active players; closer leads', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '8C' }, { id: 'B', hand: 'QC' }, { id: 'C', hand: 'JH KC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] }), 'C', { type: 'play', card: c('JH') });
    expect(s.table).toEqual([]);
    expect(s.discard).toHaveLength(3);
    expect(s.turn).toBe('C');
  });

  it('empty-handed waiting players still count; their prykup opens at vidbiy', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '', prykup: '6S 7S' }, { id: 'B', hand: 'JH QC' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'B', table: [['9H', 'A']] });
    s = act(s, 'B', { type: 'play', card: c('JH') });
    expect(s.table).toHaveLength(2);
    s = act(s, 'C', { type: 'play', card: c('KH') });
    expect(s.table).toEqual([]);
    expect(pl(s, 'A').hand).toEqual(cs('6S 7S'));
    expect(pl(s, 'A').prykup).toEqual([]);
    expect(s.turn).toBe('C');
  });

  it('empty hand and no prykup at vidbiy means the player is out', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: 'JH QC' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'B', table: [['9H', 'A']] });
    s = act(s, 'B', { type: 'play', card: c('JH') });
    s = act(s, 'C', { type: 'play', card: c('KH') });
    expect(pl(s, 'A').out).toBe(true);
    expect(s.outOrder).toEqual(['A']);
    expect(s.phase).toBe('phase2');
    expect(s.turn).toBe('C');
  });

  it('if the closer goes out, the next active player leads; vidbiy size shrinks', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '7C' }, { id: 'B', hand: '8C' }, { id: 'C', hand: 'JH' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] });
    s = act(s, 'C', { type: 'play', card: c('JH') });
    expect(pl(s, 'C').out).toBe(true);
    expect(s.turn).toBe('A');
    s = act(s, 'A', { type: 'play', card: c('7C') });
    s = act(s, 'B', { type: 'play', card: c('8C') }); // 2 карты = 2 активных → отбой
    // Обе руки пусты, прикупов нет → оба выходят одновременно → ничья.
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: null, winnerId: 'C', outOrder: ['C', 'B', 'A'], technical: false });
  });

  it('empty hand with cards on the table: the player must take', () => {
    const s = phase2State({ players: [{ id: 'A', hand: '', prykup: '6S' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'C']] });
    const s2 = act(s, 'A', { type: 'take' });
    expect(pl(s2, 'A').hand).toEqual(cs('9H'));
    expect(pl(s2, 'A').prykup).toEqual(cs('6S'));
    expect(s2.turn).toBe('B');
  });

  it('empty hand and empty table on your turn counts as vidbiy: prykup opens', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '', prykup: '6S 7S' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'C', table: [['9H', 'B']] }), 'C', { type: 'take' });
    expect(s.turn).toBe('A');
    expect(pl(s, 'A').hand).toEqual(cs('6S 7S'));
  });

  it('empty hand, empty table, no prykup: the player is out and the next one leads', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'C', table: [['9H', 'B']] }), 'C', { type: 'take' });
    expect(pl(s, 'A').out).toBe(true);
    expect(s.turn).toBe('B');
  });
});

// Пустой стол — отбой для всех: каждый активный игрок с пустой рукой открывает прикуп
// или выходит, не дожидаясь своей очереди. Порядок — по часовой от сделавшего ход.
describe('phase 2: an empty table settles every empty hand', () => {
  it('the card taken away was my last one: my prykup opens right away, out of turn', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '7S', prykup: '6S 9S' }, { id: 'B', hand: 'KC' }, { id: 'C', hand: 'QH' }], trump: 'D', turn: 'A' });
    s = act(s, 'A', { type: 'play', card: c('7S') });
    expect(pl(s, 'A').hand).toEqual([]);
    expect(pl(s, 'A').prykup).toEqual(cs('6S 9S'));
    s = act(s, 'B', { type: 'take' });
    expect(s.table).toEqual([]);
    expect(pl(s, 'A').hand).toEqual(cs('6S 9S'));
    expect(pl(s, 'A').prykup).toEqual([]);
    expect(s.turn).toBe('C');
  });

  it('the same, with no prykup left: the player is out immediately, though it is not their turn', () => {
    let s = phase2State({ players: [{ id: 'A', hand: '7S' }, { id: 'B', hand: 'KC' }, { id: 'C', hand: 'QH' }], trump: 'D', turn: 'A' });
    s = act(s, 'A', { type: 'play', card: c('7S') });
    const r = apply(s, 'B', { type: 'take' }, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([
      { type: 'tookBottom', playerId: 'B', card: c('7S') },
      { type: 'out', playerId: 'A' },
    ]);
    expect(pl(r.state, 'A').out).toBe(true);
    expect(r.state.outOrder).toEqual(['A']);
    expect(r.state.phase).toBe('phase2');
    expect(r.state.turn).toBe('C');
  });

  it('several empty hands settle at once, clockwise from the actor, past players who still hold cards', () => {
    // Места A → B → C → D. Ходит B с пустой рукой: обязан взять. Стол пустеет.
    let s = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: '' }, { id: 'C', hand: 'KC' }, { id: 'D', hand: '' }], trump: 'D', turn: 'B', table: [['7S', 'A']] });
    s = act(s, 'B', { type: 'take' });
    // C держит карты и никого не заслоняет: по часовой от B выходят D, потом A.
    expect(s.outOrder).toEqual(['D', 'A']);
    expect(s.phase).toBe('phase2');
    expect(s.turn).toBe('C');
    s = act(s, 'C', { type: 'play', card: c('KC') });
    s = act(s, 'B', { type: 'take' }); // ♠7 не бьёт ♣K, остаётся взять — стол снова пуст, C опустел
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'B', winnerId: 'D', outOrder: ['D', 'A', 'C'], technical: false });
  });

  it('when the settle leaves a single active player, the game ends and that player loses', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: '' }, { id: 'C', hand: 'QH' }], trump: 'D', turn: 'C', table: [['7S', 'A']] }), 'C', { type: 'take' });
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'C', winnerId: 'A', outOrder: ['A', 'B'], technical: false });
  });

  it('a vidbiy still settles everyone clockwise from the closer: prykup opens, empty hands go out', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '', prykup: '6S' }, { id: 'B', hand: '' }, { id: 'C', hand: 'KH QC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] }), 'C', { type: 'play', card: c('KH') });
    expect(s.table).toEqual([]);
    expect(s.discard).toHaveLength(3);
    expect(pl(s, 'A').hand).toEqual(cs('6S'));
    expect(pl(s, 'B').out).toBe(true);
    expect(s.outOrder).toEqual(['B']);
    expect(s.phase).toBe('phase2');
    expect(s.turn).toBe('C');
  });
});

describe('phase 2: game over', () => {
  it('the last player with cards loses; first out wins', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'JH' }, { id: 'B', hand: 'KC 8D' }], trump: 'D', turn: 'A', table: [['9H', 'B']] }), 'A', { type: 'play', card: c('JH') });
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'B', winnerId: 'A', outOrder: ['A'], technical: false });
    expect(apply(s, 'B', { type: 'take' }, 0)).toEqual({ ok: false, error: 'wrong_phase' });
  });

  it('several exits at one vidbiy: order goes clockwise from the closer', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: '' }, { id: 'C', hand: 'KH QC' }], trump: 'D', turn: 'C', table: [['7H', 'A'], ['9H', 'B']] }), 'C', { type: 'play', card: c('KH') });
    expect(s.result).toEqual({ loserId: 'C', winnerId: 'A', outOrder: ['A', 'B'], technical: false });
  });

  it('surrender ends the game with a technical loss', () => {
    const s = act(phase2State({ players: [{ id: 'A', hand: 'JH' }, { id: 'B', hand: 'KC' }, { id: 'C', hand: '8C' }], trump: 'D', turn: 'A' }), 'B', { type: 'surrender' });
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'B', winnerId: null, outOrder: [], technical: true });
  });
});

describe('phase 2: stalled battle', () => {
  type Step = [string, Action];
  const lead = (id: string, card: string): Step => [id, { type: 'play', card: c(card) }];
  const take = (id: string): Step => [id, { type: 'take' }];

  /** Ходит единственным законным ходом (или по политике), пока не появится событие stall. */
  const untilStall = (s: GameState, pick: (s: GameState) => Action, limit: number) => {
    for (let i = 1; i <= limit; i++) {
      const r = apply(s, s.turn, pick(s), 0);
      if (!r.ok) throw new Error(r.error);
      if (r.events.some((e) => e.type === 'stall')) return { r, actions: i };
      s = r.state;
      expect(s.phase).toBe('phase2');
    }
    throw new Error(`no stall within ${limit} actions`);
  };

  const onlyMove = (s: GameState): Action => {
    const lm = legalMoves(s, s.turn);
    const options: Action[] = [...lm.playable.map((card): Action => ({ type: 'play', card })), ...(lm.canTake ? [{ type: 'take' } as Action] : [])];
    expect(options).toHaveLength(1);
    return options[0];
  };

  const anyMove = (s: GameState): Action => {
    const lm = legalMoves(s, s.turn);
    return lm.playable.length > 0 ? { type: 'play', card: lm.playable[0] } : { type: 'take' };
  };

  // Козырь ♣, A уже вышел. B, C, D гоняют KS, QS, KD, 6D: заход → побил → взял → взял; цикл 24 хода.
  // Пустой стол случается только тогда, когда пустых рук нет, поэтому цепочка крутится по кругу
  // и позиция после захода B повторяется в 3-й раз на 49-м ходу.
  const trap = (stallRule?: StallRule) =>
    phase2State({ players: [{ id: 'A', hand: '', out: true }, { id: 'B', hand: 'QS' }, { id: 'C', hand: 'KS 6D' }, { id: 'D', hand: 'KD' }], trump: 'C', turn: 'B', stallRule });

  const trapCycle: Step[] = [
    lead('B', 'QS'), lead('C', 'KS'), take('D'), take('B'),
    lead('C', '6D'), lead('D', 'KD'), take('B'), take('C'),
    lead('D', 'QS'), lead('B', 'KS'), take('C'), take('D'),
    lead('B', '6D'), lead('C', 'KD'), take('D'), take('B'),
    lead('C', 'QS'), lead('D', 'KS'), take('B'), take('C'),
    lead('D', '6D'), lead('B', 'KD'), take('C'), take('D'),
  ];

  /** Ходит по кругу трап-цикла: на каждом шаге ход и так принадлежит нужному игроку. */
  const cyclePick = () => {
    let i = 0;
    return (): Action => trapCycle[i++ % trapCycle.length][1];
  };

  it('the trap: a position seen for the 3rd time forces a vidbiy, and the game ends', () => {
    const { r, actions } = untilStall(trap(), cyclePick(), 60);
    expect(actions).toBe(49);
    expect(r.events).toContainEqual({ type: 'stall', rule: 'forcedVidbiy' });
    // Принудительный отбой закрывает B, только что зашедший последней картой: рука пуста,
    // прикупа нет → B выходит, значит отбой был продуктивным и партия продолжается.
    expect(r.events).toContainEqual({ type: 'vidbiy', closerId: 'B' });
    expect(r.state.outOrder).toEqual(['A', 'B']);
    let s = r.state;
    expect(s.phase).toBe('phase2');
    for (let i = 0; i < 40 && s.phase !== 'over'; i++) s = act(s, s.turn, anyMove(s));
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'D', winnerId: 'A', outOrder: ['A', 'B', 'C'], technical: false });
  });

  it('the trap under endGame: most cards loses', () => {
    const { r, actions } = untilStall(trap('endGame'), cyclePick(), 60);
    expect(actions).toBe(49);
    expect(r.events).toContainEqual({ type: 'stall', rule: 'endGame' });
    expect(r.state.phase).toBe('over');
    // Ходит C; карты: C 2 (KS, 6D), D 1 (KD), B 0 (QS на столе) → проигрывает C.
    expect(r.state.result).toEqual({ loserId: 'C', winnerId: 'A', outOrder: ['A'], technical: false });
  });

  it('a stall on an empty table without empty hands: the no-op forced vidbiy ends the game by card count', () => {
    // Козырь ♦; C нечем бить ♥9 и он забирает её — стол пустеет, но пустых рук нет,
    // так что ни отбоя, ни выхода: прогресса нет и позиция считается.
    const s0 = phase2State({ players: [{ id: 'A', hand: '2S 4S' }, { id: 'B', hand: '4C 9C' }, { id: 'C', hand: '7C' }], trump: 'D', turn: 'C', table: [['9H', 'B']], deckSize: 52 });
    expect(legalMoves(s0, 'C').playable).toEqual([]);
    const once = act(s0, 'C', { type: 'take' });
    expect(once.table).toEqual([]);
    expect(once.phase).toBe('phase2');
    // Та же позиция в 3-й раз: принудительный отбой ничего не меняет → партия кончается по картам.
    const r = apply({ ...s0, positions: { [positionHash(once)]: 2 } }, 'C', { type: 'take' }, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([
      { type: 'tookBottom', playerId: 'C', card: c('9H') },
      { type: 'stall', rule: 'forcedVidbiy' },
      { type: 'vidbiy', closerId: 'C' },
      { type: 'gameOver', result: { loserId: 'A', winnerId: null, outOrder: [], technical: false } },
    ]);
    expect(r.state.phase).toBe('over');
    // Ходит A, у всех по 2 карты → при равенстве проигрывает первый по часовой от ходящего.
    expect(r.state.result).toEqual({ loserId: 'A', winnerId: null, outOrder: [], technical: false });
  });

  it('normal play does not stall: lead, take, lead, take until the leader runs out', () => {
    let s = phase2State({ players: [{ id: 'A', hand: 'AS KS 7C 8C 9C' }, { id: 'B', hand: '6H 8H JH QH' }], trump: 'D', turn: 'A' });
    const events = [];
    for (let i = 0; i < 20 && s.phase !== 'over'; i++) {
      const action: Action = s.turn === 'A' ? { type: 'play', card: pl(s, 'A').hand[0] } : { type: 'take' };
      const r = apply(s, s.turn, action, 0);
      if (!r.ok) throw new Error(r.error);
      events.push(...r.events);
      s = r.state;
    }
    expect(events.some((e) => e.type === 'stall')).toBe(false);
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: 'B', winnerId: 'A', outOrder: ['A'], technical: false });
  });

  it('progress resets the history: an exit through an empty hand on an empty table', () => {
    const s0 = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: 'JH' }, { id: 'C', hand: 'KH 8C' }], trump: 'D', turn: 'C', table: [['9H', 'B']] });
    s0.positions = { x: 2, y: 1 };
    const r = apply(s0, 'C', { type: 'take' }, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pl(r.state, 'A').out).toBe(true);
    expect(r.state.positions).toEqual({ [positionHash(r.state)]: 1 });
    expect(r.events.some((e) => e.type === 'stall')).toBe(false);
  });

  it('a position without progress is counted; the 3rd occurrence fires', () => {
    const s0 = phase2State({ players: [{ id: 'A', hand: 'JH 7C' }, { id: 'B', hand: 'QH' }, { id: 'C', hand: 'KC' }], trump: 'D', turn: 'A', table: [['9H', 'C']] });
    const once = act(s0, 'A', { type: 'take' });
    expect(once.positions).toEqual({ [positionHash(once)]: 1 });
    const twice = { ...s0, positions: { [positionHash(once)]: 1 } };
    expect(act(twice, 'A', { type: 'take' }).positions).toEqual({ [positionHash(once)]: 2 });
    const r = apply({ ...s0, positions: { [positionHash(once)]: 2 } }, 'A', { type: 'take' }, 0);
    expect(r.ok && r.events).toContainEqual({ type: 'stall', rule: 'forcedVidbiy' });
  });

  it('positions are keyed by a compact FNV-1a hash of the readable key', () => {
    const s = phase2State({ players: [{ id: 'A', hand: 'JH 7C' }, { id: 'B', hand: 'QH' }], trump: 'D', turn: 'A', table: [['9H', 'B']] });
    expect(positionKey(s)).toBe('A#9HB#7C,JH|QH');
    expect(positionHash(s)).toMatch(/^[0-9a-f]{8}$/);
    expect(positionHash(s)).toBe(fnv1a(positionKey(s)));
    expect(positionHash({ ...s, turn: 'B' })).not.toBe(positionHash(s));
  });

  it('a loop with beats is caught too: every move names its player explicitly', () => {
    let s = trap();
    let stallAt = 0;
    for (let i = 0; i < 60 && !stallAt; i++) {
      const [id, action] = trapCycle[i % trapCycle.length];
      const r = apply(s, id, action, 0);
      if (!r.ok) throw new Error(`${i} ${id} ${action.type}: ${r.error}`);
      if (r.events.some((e) => e.type === 'stall')) stallAt = i + 1;
      s = r.state;
    }
    expect(stallAt).toBe(49);
  });

  it('the old empty-hand loop cannot happen: an empty table settles it long before any stall', () => {
    // Раньше это была бесконечная карусель: A заходит 3C, B (пустая рука) берёт, C заходит 2C,
    // A берёт… Теперь стол пустеет сразу после взятия B, и A с пустой рукой выходит.
    let s = phase2State({ players: [{ id: 'A', hand: '3C' }, { id: 'B', hand: '' }, { id: 'C', hand: '2C' }], trump: 'H', turn: 'A', deckSize: 52 });
    const events: GameEvent[] = [];
    for (let i = 0; i < 20 && s.phase !== 'over'; i++) {
      const r = apply(s, s.turn, anyMove(s), 0);
      if (!r.ok) throw new Error(r.error);
      events.push(...r.events);
      s = r.state;
    }
    expect(events.some((e) => e.type === 'stall')).toBe(false);
    // A выходит на пустой стол сразу после взятия B; дальше C заходит 2C, B бьёт 3C —
    // отбой на двоих, обе руки пусты, оба выходят вместе: ничья, проигравшего нет.
    expect(events.filter((e) => e.type === 'out').map((e) => e.playerId)).toEqual(['A', 'B', 'C']);
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ loserId: null, winnerId: 'A', outOrder: ['A', 'B', 'C'], technical: false });
  });
});
