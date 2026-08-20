export function mondayISO(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return addDaysISO(weekStart, weeks * 7);
}

export function formatDayMonth(iso: string, locale: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
