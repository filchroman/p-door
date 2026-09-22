import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIBRATE_VAKHTA, vibrate } from './haptics';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate');
});

describe('vibrate', () => {
  it('buzzes when the device can', () => {
    const spy = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true });
    vibrate(VIBRATE_VAKHTA);
    expect(spy).toHaveBeenCalledWith([40, 30, 40]);
  });

  it('does nothing without navigator.vibrate', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(() => vibrate(80)).not.toThrow();
  });
});
