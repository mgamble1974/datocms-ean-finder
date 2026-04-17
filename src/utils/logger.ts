import { LogEntry } from '../types';

const LOG_KEY = 'datocms-ean-finder-logs';
const MAX_ENTRIES = 500;

export function addLogEntry(entry: LogEntry): void {
  const existing = getLogs();
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(updated));
  } catch {
    // localStorage niet beschikbaar
  }
}

export function getLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    // ignore
  }
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${datePart} ${timePart}.${ms}`;
}
