import { describe, expect, it } from 'vitest';
import { INIT_DATA_MAX_AGE_S, displayName, signInitData, verifyInitData } from '../src/auth/telegram';

const TOKEN = '123456:TEST-TOKEN';
const NOW = 1_800_000_000_000;

function initData(over: Record<string, string> = {}, token = TOKEN): string {
  const pairs: Record<string, string> = {
    auth_date: String(Math.floor(NOW / 1000) - 60),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({ id: 42, first_name: 'Рома', last_name: 'Ф', username: 'roma', photo_url: 'https://t.me/i/userpic/roma.jpg' }),
    ...over,
  };
  pairs.hash = signInitData(pairs, token);
  return new URLSearchParams(pairs).toString();
}

describe('verifyInitData', () => {
  it('принимает подписанные данные и достаёт пользователя и start_param', () => {
    const auth = verifyInitData(initData({ start_param: 'K7PQ' }), TOKEN, NOW)!;
    expect(auth.user).toEqual({ id: 42, firstName: 'Рома', lastName: 'Ф', username: 'roma', photoUrl: 'https://t.me/i/userpic/roma.jpg' });
    expect(auth.startParam).toBe('K7PQ');
  });

  it('отклоняет подделку: чужой токен, изменённые поля, битый хэш', () => {
    expect(verifyInitData(initData({}, 'other:token'), TOKEN, NOW)).toBeNull();
    const forged = initData().replace('%22id%22%3A42', '%22id%22%3A43');
    expect(verifyInitData(forged, TOKEN, NOW)).toBeNull();
    expect(verifyInitData(initData().replace(/hash=[0-9a-f]+/, 'hash=00'), TOKEN, NOW)).toBeNull();
    expect(verifyInitData('', TOKEN, NOW)).toBeNull();
  });

  it('отклоняет просроченные данные', () => {
    const old = initData({ auth_date: String(Math.floor(NOW / 1000) - INIT_DATA_MAX_AGE_S - 1) });
    expect(verifyInitData(old, TOKEN, NOW)).toBeNull();
  });

  it('displayName: имя и фамилия, иначе @username, иначе запасное', () => {
    expect(displayName({ id: 1, firstName: 'Рома', lastName: 'Ф', username: 'r', photoUrl: '' }, 'Игрок')).toBe('Рома Ф');
    expect(displayName({ id: 1, firstName: '', lastName: '', username: 'roma', photoUrl: '' }, 'Игрок')).toBe('@roma');
    expect(displayName({ id: 1, firstName: '', lastName: '', username: '', photoUrl: '' }, 'Игрок')).toBe('Игрок');
  });
});
