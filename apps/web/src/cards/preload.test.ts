import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACK_URL, faceUrl } from './art';
import { decodeImage, deckUrls, preloadDeck } from './preload';

afterEach(() => vi.unstubAllGlobals());

describe('preloadDeck', () => {
  it('decodes every face of the chosen deck and the back before the deal', async () => {
    const load = vi.fn((_url: string) => Promise.resolve());
    await preloadDeck(36, load);
    const urls = load.mock.calls.map(([url]) => url);
    expect(urls).toHaveLength(37);
    expect(new Set(urls).size).toBe(37);
    expect(urls).toContain(BACK_URL);
    expect(urls).toContain(faceUrl({ rank: 6, suit: 'C' }));
    expect(urls).not.toContain(faceUrl({ rank: 5, suit: 'C' }));
    expect(deckUrls(52)).toHaveLength(53);
  });

  it('waits for all decodes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let done = false;
    const pending = preloadDeck(36, () => gate).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });

  it('decodeImage never rejects and decodes each URL once', async () => {
    const decode = vi.fn(() => Promise.resolve());
    const broken = vi.fn(() => Promise.reject(new Error('broken')));
    let next = decode;
    class FakeImage {
      decoding = '';
      src = '';
      decode = next;
    }
    vi.stubGlobal('Image', FakeImage);
    await decodeImage('/a.webp');
    await decodeImage('/a.webp');
    expect(decode).toHaveBeenCalledTimes(1);
    next = broken;
    await expect(decodeImage('/b.webp')).resolves.toBeUndefined();
  });
});
