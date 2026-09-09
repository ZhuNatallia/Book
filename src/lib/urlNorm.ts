const DROP_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igsh',
  'igshid',
  'si',
  'feature',
  'pp',
  'mibextid',
  'share_id',
  'ref',
  'ref_src',
  'mc_cid',
  'mc_eid',
]);

function dropSearchParams(search: string): string {
  if (!search) return '';
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || DROP_PARAMS.has(lower)) {
      params.delete(key);
    }
  }
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function normalizeSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${host}${path}${dropSearchParams(parsed.search)}`;
  } catch {
    return trimmed.replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
  }
}
