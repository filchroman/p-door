import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Vitest запускают и из корня монорепозитория, и из пакета. */
const SRC = existsSync('apps/web/src') ? 'apps/web/src' : 'src';

function sources(dir: string): string[] {
  return readdirSync(join(SRC, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(SRC, rel)).isDirectory()) return sources(rel);
    return /\.tsx?$/.test(name) ? [rel] : [];
  });
}

const importsHost = (rel: string): boolean => /from '[^']*host\//.test(readFileSync(join(SRC, rel), 'utf8'));

/**
 * Шов клиента держит направление: хост зависит от клиента, а не наоборот, и экраны
 * ничего не знают про локальный хост — иначе сетевой клиент (Socket.io) не подставить.
 */
describe('layering', () => {
  it('nothing in ui/ or store/ reaches into host/', () => {
    expect([...sources('ui'), ...sources('store')].filter(importsHost)).toEqual([]);
  });

  it('the client seam itself is host-free: only the local adapters know the host', () => {
    const adapters = ['client/LocalGameClient.ts', 'client/createLocalMatch.ts', 'client/LocalGameClient.test.ts'];
    expect(sources('client').filter((rel) => importsHost(rel) && !adapters.includes(rel))).toEqual([]);
  });
});
