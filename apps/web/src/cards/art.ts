import { cardToString, type Card } from '@vakhta/engine';

const files = import.meta.glob<string>('./art/*.webp', { query: '?url', import: 'default', eager: true });

/** Код карты (cardToString) или 'back' → URL растра. */
export const ART_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice('./art/'.length, -'.webp'.length), url]),
);

export const BACK_URL: string = ART_URLS.back;

export function faceUrl(card: Card): string {
  const code = card.rank >= 2 && card.rank <= 14 ? cardToString(card) : '';
  const url = ART_URLS[code];
  if (!url) throw new Error(`no art for rank ${card.rank} ${card.suit}`);
  return url;
}
