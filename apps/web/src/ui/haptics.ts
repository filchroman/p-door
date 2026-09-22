export const VIBRATE_VAKHTA = [40, 30, 40];
export const VIBRATE_ERROR = 80;

/** Вибрация, если устройство умеет (спека §2a): «ВАХТА!» и отклонённое действие. */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // нет вибромотора или запрещено политикой — молча
  }
}
