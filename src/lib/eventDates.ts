export const todayManila = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => utc(d).toLocaleString('en-US', { ...o, timeZone: 'UTC' });

export const monthShort = (d: string) => fmt(d, { month: 'short' });
export const dayNum = (d: string) => fmt(d, { day: 'numeric' });

export function dateRange(date: string, endDate: string | null): string {
  const base = fmt(date, { weekday: 'short', month: 'short', day: 'numeric' });
  if (!endDate || endDate === date) return base;
  const sameMonth = monthShort(date) === monthShort(endDate);
  return sameMonth
    ? `${monthShort(date)} ${dayNum(date)}–${dayNum(endDate)}`
    : `${monthShort(date)} ${dayNum(date)} – ${monthShort(endDate)} ${dayNum(endDate)}`;
}

export function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

export function relativeLabel(date: string, endDate: string | null, today = todayManila()): string {
  const last = endDate ?? date;
  if (today > last) return 'Finished';
  if (today >= date) return date === last ? 'Today' : 'Happening now';
  const days = Math.round((utc(date).getTime() - utc(today).getTime()) / 86400000);
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}
