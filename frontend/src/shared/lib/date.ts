const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day as YYYY-MM-DD (Ghana is UTC+0 all year, no DST). */
export const dayKey = (d: Date = new Date()): string => d.toLocaleDateString('en-CA');

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);

export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
