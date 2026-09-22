import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AtlasEntry {
  /** cardToString(card) — '2C'…'AS', или 'back'. */
  code: string;
  /** Имя файла на Wikimedia Commons, дословно. */
  file: string;
  url: string;
  /** sha1 закреплённой ревизии (из API Commons, imageinfo.sha1). */
  sha1: string;
  uploaded: string;
}

/** Описательный User-Agent — требование правил Wikimedia к скриптам. */
export const USER_AGENT = 'VakhtaCardGame/0.1 (one-off asset build script for a local card game; Node fetch)';

export const CARD_WIDTH = 240;
export const CARD_HEIGHT = 360;
export const CLOTH_SIZE = 512;

/** «Атласная» колода, Dmitry Fomin, CC0 — Category:SVG Atlasnye playing cards. */
export const ATLAS: AtlasEntry[] = [
  { code: '2C', file: 'Atlas deck 2 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Atlas_deck_2_of_clubs.svg', sha1: '24978a93ee063754237726773dc59a26e85048ad', uploaded: '2014-07-24T06:42:05Z' },
  { code: '3C', file: 'Atlas deck 3 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Atlas_deck_3_of_clubs.svg', sha1: 'de08e5ad294723e8f875fb800dec8a48b258993d', uploaded: '2014-07-24T06:42:05Z' },
  { code: '4C', file: 'Atlas deck 4 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Atlas_deck_4_of_clubs.svg', sha1: '0262277654f5e081220d65d1b245986117b05988', uploaded: '2014-07-24T06:42:05Z' },
  { code: '5C', file: 'Atlas deck 5 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Atlas_deck_5_of_clubs.svg', sha1: 'dceaa67b28a854d014cc03808531b00458d78afd', uploaded: '2014-07-24T06:42:08Z' },
  { code: '6C', file: 'Atlas deck 6 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Atlas_deck_6_of_clubs.svg', sha1: '4b4c8a7a6c29fd2b6b138c0e022974661fd4d645', uploaded: '2014-07-24T06:42:09Z' },
  { code: '7C', file: 'Atlas deck 7 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Atlas_deck_7_of_clubs.svg', sha1: 'f7d29882ee7676e37f508440054a2f621c2b4305', uploaded: '2014-07-24T06:42:09Z' },
  { code: '8C', file: 'Atlas deck 8 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Atlas_deck_8_of_clubs.svg', sha1: '517fc534728be6c626c5269492e247c429e5a088', uploaded: '2014-07-24T06:42:11Z' },
  { code: '9C', file: 'Atlas deck 9 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Atlas_deck_9_of_clubs.svg', sha1: '50389e7288af03b46d3bdb3f53d75b46bbfcb8e2', uploaded: '2014-07-24T06:42:12Z' },
  { code: 'TC', file: 'Atlas deck 10 of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Atlas_deck_10_of_clubs.svg', sha1: 'dfe16f373a50de6764507d8eef671dc646202a02', uploaded: '2014-07-24T06:42:12Z' },
  { code: 'JC', file: 'Atlas deck jack of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Atlas_deck_jack_of_clubs.svg', sha1: '7645a01c72e94c362f47c04588ff9db4c73164a0', uploaded: '2014-07-24T06:42:16Z' },
  { code: 'QC', file: 'Atlas deck queen of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/59/Atlas_deck_queen_of_clubs.svg', sha1: 'e2b87f31664d66bf1e534ab0f3ecd7e5888a49c6', uploaded: '2014-07-24T06:42:18Z' },
  { code: 'KC', file: 'Atlas deck king of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Atlas_deck_king_of_clubs.svg', sha1: '06e757c6d099ab8d564fd8fa079c4401ee082c36', uploaded: '2014-07-24T06:42:16Z' },
  { code: 'AC', file: 'Atlas deck ace of clubs.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Atlas_deck_ace_of_clubs.svg', sha1: '2cf218aeb907866e0c53c94b6b1cf121f1260566', uploaded: '2014-07-24T06:42:14Z' },
  { code: '2D', file: 'Atlas deck 2 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Atlas_deck_2_of_diamonds.svg', sha1: '03699be9841de7bf7735be1e39a3117fbaa26b00', uploaded: '2014-07-24T04:00:09Z' },
  { code: '3D', file: 'Atlas deck 3 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Atlas_deck_3_of_diamonds.svg', sha1: '17efc8cdaed3d027e13761e37fb362ca7889440a', uploaded: '2014-07-24T03:52:00Z' },
  { code: '4D', file: 'Atlas deck 4 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Atlas_deck_4_of_diamonds.svg', sha1: '4110d5709629fd7403766c0a66ed04f813ecfe5e', uploaded: '2014-07-24T03:52:00Z' },
  { code: '5D', file: 'Atlas deck 5 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Atlas_deck_5_of_diamonds.svg', sha1: 'a81b6ba52947da1b3f6c7f8282df50f7bb33b0ac', uploaded: '2014-07-24T03:52:03Z' },
  { code: '6D', file: 'Atlas deck 6 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Atlas_deck_6_of_diamonds.svg', sha1: '3e67d42a3b0eb05c4c69991337237ebc188b9bc0', uploaded: '2014-07-24T04:07:34Z' },
  { code: '7D', file: 'Atlas deck 7 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Atlas_deck_7_of_diamonds.svg', sha1: '762c510c3b6dcfc734f5f1e3481153e1d8f8a63d', uploaded: '2014-07-24T03:52:04Z' },
  { code: '8D', file: 'Atlas deck 8 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Atlas_deck_8_of_diamonds.svg', sha1: '5189b8c6f1d5666459084b02be00796a7c6b837f', uploaded: '2014-07-24T03:52:04Z' },
  { code: '9D', file: 'Atlas deck 9 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Atlas_deck_9_of_diamonds.svg', sha1: 'ace2c5a1f95a2647b4c53b4945946a40c8bb57b0', uploaded: '2014-12-30T14:46:36Z' },
  { code: 'TD', file: 'Atlas deck 10 of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Atlas_deck_10_of_diamonds.svg', sha1: '06f173ee8214eabe8792083c20cec6a0e443159a', uploaded: '2014-07-24T03:52:06Z' },
  { code: 'JD', file: 'Atlas deck jack of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Atlas_deck_jack_of_diamonds.svg', sha1: '53340184af62d9ef7d8c66bf723a2d4592094f54', uploaded: '2014-07-24T04:07:34Z' },
  { code: 'QD', file: 'Atlas deck queen of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Atlas_deck_queen_of_diamonds.svg', sha1: '669bced8a0f264a0d14b5abeea2ee2e7d9f52ff8', uploaded: '2014-07-24T04:07:37Z' },
  { code: 'KD', file: 'Atlas deck king of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Atlas_deck_king_of_diamonds.svg', sha1: '9ebb55e0e80dde9bdaf20e2826d68ad66115d034', uploaded: '2014-07-24T04:07:36Z' },
  { code: 'AD', file: 'Atlas deck ace of diamonds.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Atlas_deck_ace_of_diamonds.svg', sha1: '61637012aae376baea8953b609a0d997ebc26b0f', uploaded: '2014-07-24T03:52:07Z' },
  { code: '2H', file: 'Atlas deck 2 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Atlas_deck_2_of_hearts.svg', sha1: '69c272d55a901e25e411723b9b18c33e6d4a8fe7', uploaded: '2014-07-24T03:01:09Z' },
  { code: '3H', file: 'Atlas deck 3 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Atlas_deck_3_of_hearts.svg', sha1: '1097cc3e16ceebb2cf0354cfb7e393ee2e039625', uploaded: '2014-07-24T03:01:51Z' },
  { code: '4H', file: 'Atlas deck 4 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Atlas_deck_4_of_hearts.svg', sha1: '030e42c5483d1920f97b1b254031af18957b3898', uploaded: '2014-07-24T03:02:59Z' },
  { code: '5H', file: 'Atlas deck 5 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Atlas_deck_5_of_hearts.svg', sha1: 'b0bbc5e2a83e94b400d0bb203985f25e1a5ab15c', uploaded: '2014-07-24T03:03:28Z' },
  { code: '6H', file: 'Atlas deck 6 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Atlas_deck_6_of_hearts.svg', sha1: '575461b4d496bedf48d9e55219a7c9962cd9c2b8', uploaded: '2014-07-24T03:04:15Z' },
  { code: '7H', file: 'Atlas deck 7 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Atlas_deck_7_of_hearts.svg', sha1: '23e17c99cf03b0893e3b74f826d8a6cb32b9a59e', uploaded: '2014-07-24T03:05:19Z' },
  { code: '8H', file: 'Atlas deck 8 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Atlas_deck_8_of_hearts.svg', sha1: '72555386dedddcad79396e239589933cefe1ac41', uploaded: '2014-07-24T03:05:48Z' },
  { code: '9H', file: 'Atlas deck 9 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Atlas_deck_9_of_hearts.svg', sha1: '9a5e4f583b8fd7991112080771775994d9e574cb', uploaded: '2014-07-24T03:06:19Z' },
  { code: 'TH', file: 'Atlas deck 10 of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Atlas_deck_10_of_hearts.svg', sha1: '1a2783ef14897ac4d6ea5cbf366a68580cf57d01', uploaded: '2014-07-24T03:06:53Z' },
  { code: 'JH', file: 'Atlas deck jack of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Atlas_deck_jack_of_hearts.svg', sha1: '6bbb6b02345cd0280a00f82a71165d645d9df292', uploaded: '2014-07-24T03:08:49Z' },
  { code: 'QH', file: 'Atlas deck queen of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Atlas_deck_queen_of_hearts.svg', sha1: '715bdda862f13f19da48b7399918056a8d39f998', uploaded: '2014-07-24T03:09:43Z' },
  { code: 'KH', file: 'Atlas deck king of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Atlas_deck_king_of_hearts.svg', sha1: '6366430521d9e34c85629fbcc588642fe1964eb5', uploaded: '2014-07-24T03:10:22Z' },
  { code: 'AH', file: 'Atlas deck ace of hearts.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Atlas_deck_ace_of_hearts.svg', sha1: '5ae583139e278addc6867bf1b0038eac5161527d', uploaded: '2014-07-24T02:52:11Z' },
  { code: '2S', file: 'Atlas deck 2 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Atlas_deck_2_of_spades.svg', sha1: '24afbf332261f351c5f5da664b8f81d70ac537c9', uploaded: '2014-07-24T11:57:50Z' },
  { code: '3S', file: 'Atlas deck 3 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Atlas_deck_3_of_spades.svg', sha1: '14a07fd554e6c38bf45f0db75b36bb9cdf45ab6d', uploaded: '2014-07-24T11:57:51Z' },
  { code: '4S', file: 'Atlas deck 4 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Atlas_deck_4_of_spades.svg', sha1: 'c0998a3dc146791c5afd312ebd4ad123ec108b58', uploaded: '2014-07-24T11:57:51Z' },
  { code: '5S', file: 'Atlas deck 5 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Atlas_deck_5_of_spades.svg', sha1: '89bd9d9320b500bd841ad5a57709a073b8ba8661', uploaded: '2014-07-24T11:57:53Z' },
  { code: '6S', file: 'Atlas deck 6 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Atlas_deck_6_of_spades.svg', sha1: '7684d52d229f6b5ab084082b4d381f41d606a626', uploaded: '2014-07-24T11:57:54Z' },
  { code: '7S', file: 'Atlas deck 7 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Atlas_deck_7_of_spades.svg', sha1: '0b38193ee11a0582081cce5405c2122637ff0c25', uploaded: '2014-07-24T11:57:54Z' },
  { code: '8S', file: 'Atlas deck 8 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Atlas_deck_8_of_spades.svg', sha1: '7ea583bd325920b4b805ad31d4160ef63d97267c', uploaded: '2014-07-24T11:57:55Z' },
  { code: '9S', file: 'Atlas deck 9 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Atlas_deck_9_of_spades.svg', sha1: 'eb608f9d1c8585f2f16f59b1463809db6b6f1706', uploaded: '2014-07-24T11:57:57Z' },
  { code: 'TS', file: 'Atlas deck 10 of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Atlas_deck_10_of_spades.svg', sha1: 'dff813250f0a7f612b24e82ab422149effaaa027', uploaded: '2014-07-24T11:57:57Z' },
  { code: 'JS', file: 'Atlas deck jack of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Atlas_deck_jack_of_spades.svg', sha1: 'b4a4454fdcaae26ab8241930eea966795ddde841', uploaded: '2014-07-24T11:57:59Z' },
  { code: 'QS', file: 'Atlas deck queen of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Atlas_deck_queen_of_spades.svg', sha1: '699ecf585b53dbdd102acd65c378decaf41e726d', uploaded: '2014-07-24T11:58:01Z' },
  { code: 'KS', file: 'Atlas deck king of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Atlas_deck_king_of_spades.svg', sha1: '42233a0efb18a0bac4ac07eb45f6c973d225ce3c', uploaded: '2014-07-24T11:58:01Z' },
  { code: 'AS', file: 'Atlas deck ace of spades.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Atlas_deck_ace_of_spades.svg', sha1: '68b558326591f56750c78c042dfcf883f5237b38', uploaded: '2014-07-24T11:57:58Z' },
  { code: 'back', file: 'Atlas deck card back blue and brown.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Atlas_deck_card_back_blue_and_brown.svg', sha1: '14c2b8f00648524e8954f1883470c87449aad541', uploaded: '2022-10-01T15:03:21Z' },
];

/** Плитка сукна: синий фон + фрактальный шум. userSpaceOnUse обязателен для librsvg. */
export const CLOTH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${CLOTH_SIZE}" height="${CLOTH_SIZE}"><filter id="n" x="0" y="0" width="${CLOTH_SIZE}" height="${CLOTH_SIZE}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"/></filter><rect width="${CLOTH_SIZE}" height="${CLOTH_SIZE}" fill="#1d4f91"/><rect width="${CLOTH_SIZE}" height="${CLOTH_SIZE}" filter="url(#n)"/></svg>`;

export function sha1Hex(data: Uint8Array): string {
  return createHash('sha1').update(data).digest('hex');
}

/** Пауза перед повтором: Retry-After (секунды), иначе 5 с × 2^попытка, не больше минуты. */
export function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return Math.min(60_000, 5_000 * 2 ** attempt);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function download(entry: AtlasEntry): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(entry.url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.ok) {
      const data = new Uint8Array(await response.arrayBuffer());
      const sha1 = sha1Hex(data);
      if (sha1 !== entry.sha1) throw new Error(`${entry.file}: sha1 ${sha1}, expected ${entry.sha1} — the Commons revision changed`);
      return data;
    }
    if (response.status !== 429 && response.status < 500) throw new Error(`${entry.file}: HTTP ${response.status}`);
    await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
  }
  throw new Error(`${entry.file}: too many retries`);
}

const here = dirname(fileURLToPath(import.meta.url));
const artDir = join(here, '../src/cards/art');
const sourceDir = join(artDir, 'source');

async function fetchAll(): Promise<void> {
  mkdirSync(sourceDir, { recursive: true });
  for (const entry of ATLAS) {
    const target = join(sourceDir, `${entry.code}.svg`);
    if (existsSync(target) && sha1Hex(readFileSync(target)) === entry.sha1) continue;
    writeFileSync(target, await download(entry));
    console.log(`${entry.code} <- ${entry.file}`);
    await sleep(1000);
  }
}

async function rasterizeAll(): Promise<void> {
  const { default: sharp } = await import('sharp');
  let bytes = 0;
  for (const entry of ATLAS) {
    const info = await sharp(join(sourceDir, `${entry.code}.svg`), { density: 144 })
      .resize(CARD_WIDTH, CARD_HEIGHT)
      .webp({ quality: 88, effort: 6 })
      .toFile(join(artDir, `${entry.code}.webp`));
    bytes += info.size;
  }
  const cloth = await sharp(Buffer.from(CLOTH_SVG)).webp({ quality: 80 }).toFile(join(here, '../src/ui/cloth.webp'));
  console.log(`cards: ${ATLAS.length} files, ${bytes} bytes; cloth: ${cloth.size} bytes`);
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === 'fetch') await fetchAll();
  else if (command === 'rasterize') await rasterizeAll();
  else {
    console.error('usage: node scripts/atlas.ts fetch|rasterize');
    process.exitCode = 1;
  }
}
