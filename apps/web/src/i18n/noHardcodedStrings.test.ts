import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(
  ['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../i18n/**', '!../test/**'],
  { query: '?raw', import: 'default', eager: true },
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('i18n', () => {
  it('keeps every UI string in i18n/ru.ts', () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => /[А-Яа-яЁё]/.test(stripComments(source)))
      .map(([path]) => path);
    expect(Object.keys(sources).length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
