export function normalizeSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${host}${path}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
  }
}
