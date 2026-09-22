import { makeDeck, type DeckSize } from '@vakhta/engine';
import { BACK_URL, faceUrl } from './art';

/** Держим декодированные картинки, чтобы браузер не выгрузил их до конца сессии. */
const decoded = new Map<string, HTMLImageElement>();

/** Загрузить и декодировать картинку вне главного потока; ошибка не блокирует партию. */
export function decodeImage(url: string): Promise<void> {
  if (decoded.has(url)) return Promise.resolve();
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  decoded.set(url, img);
  return img.decode().catch(() => {
    decoded.delete(url);
  });
}

export function deckUrls(deckSize: DeckSize): string[] {
  return [...makeDeck(deckSize).map(faceUrl), BACK_URL];
}

/** Все лица колоды и рубашка декодированы до первой раздачи (спека §2a). */
export async function preloadDeck(deckSize: DeckSize, load: (url: string) => Promise<void> = decodeImage): Promise<void> {
  await Promise.all(deckUrls(deckSize).map((url) => load(url)));
}
