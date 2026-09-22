import type { LogEntry } from '../../client/debug';

export function formatLogEntry(entry: LogEntry): string {
  const time = new Date(entry.at).toISOString().slice(11, 19);
  const what = entry.note ?? (entry.action ? JSON.stringify(entry.action) : '');
  const result = entry.error
    ? ` ✗ ${entry.error}`
    : entry.events.length > 0
      ? ` → ${entry.events.map((e) => e.type).join(', ')}`
      : '';
  return `${time} ${entry.playerId ?? '-'} ${what}${result}`;
}
