/** Кадров в секунду по меткам requestAnimationFrame за последнее окно. */
export function fpsOf(frameTimes: number[], windowMs: number, now: number): number {
  const recent = frameTimes.filter((t) => now - t < windowMs);
  return Math.round((recent.length * 1000) / windowMs);
}
