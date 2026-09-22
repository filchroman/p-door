import { describe, expect, it } from 'vitest';
import { dative, plural, ru } from './ru';

describe('ru', () => {
  it('declines Russian plurals', () => {
    const forms: [string, string, string] = ['фол', 'фола', 'фолов'];
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25, 111].map((n) => plural(n, forms))).toEqual([
      'фол', 'фола', 'фола', 'фолов', 'фолов', 'фолов', 'фол', 'фола', 'фолов', 'фолов',
    ]);
  });

  it('puts names into the dative for «переложил …»', () => {
    expect(['Боря', 'Галя', 'Люда', 'Петрович', 'Семён', 'Тест'].map(dative)).toEqual([
      'Боре', 'Гале', 'Люде', 'Петровичу', 'Семёну', 'Тесту',
    ]);
    expect(dative('Мария')).toBe('Марии');
    // Ник на латинице или с гласной на конце не склоняем — лучше без падежа, чем «Игроку» из «Igro».
    expect(dative('Igor')).toBe('Igor');
    expect(dative('Петро')).toBe('Петро');
  });

  it('names every action of §2c', () => {
    expect(ru.act.drew).toBe('вытянул');
    expect(ru.act.kept).toBe('оставил себе');
    expect(ru.act.played).toBe('побил');
    expect(ru.act.tookBottom).toBe('взял нижнюю');
    expect(ru.act.moved('Галя')).toBe('переложил Гале');
  });

  it('formats the penalty prompt exactly as in the spec', () => {
    expect(ru.penalty.choose('Боря', 2, 2)).toBe('Боря получил 2 фола — выберите 2 карты для него');
    expect(ru.penalty.choose('Галя', 1, 1)).toBe('Галя получил 1 фол — выберите 1 карту для него');
  });

  it('has Russian card indices and toasts', () => {
    expect([11, 12, 13, 14].map((r) => ru.ranks[r])).toEqual(['В', 'Д', 'К', 'Т']);
    expect(ru.toast.vakhtaFoul('Боря')).toBe('Вахта! Боря получил фол');
    expect(ru.toast.falseAlarm).toBe('Ложная тревога');
    expect(ru.table.toVidbiy(1, 3)).toBe('1/3 до отбоя');
    expect(ru.table.trump('H')).toBe('Козырь: чирва');
    expect(ru.botNames).toHaveLength(5);
    expect(ru.botAvatars).toHaveLength(5);
    expect(ru.status.caught).toBe('Поймал!');
    expect(ru.fx.stamp).toBe('ВАХТА!');
  });
});
