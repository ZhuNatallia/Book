const STORAGE_KEY = 'pending-gift';

export function parseGiftInput(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get('gift')?.trim();
    if (fromQuery) return fromQuery.toLowerCase();
    if (url.pathname.startsWith('/gift/')) {
      return decodeURIComponent(url.pathname.slice(6).split('/')[0] || '').trim().toLowerCase();
    }
  } catch {
    /* not a URL */
  }
  return value.toLowerCase();
}

export function persistGiftFromUrl() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  let token = params.get('gift')?.trim() || '';
  if (!token && window.location.pathname.startsWith('/gift/')) {
    token = decodeURIComponent(window.location.pathname.slice(6).split('/')[0] || '').trim();
  }
  if (!token) return;
  try {
    localStorage.setItem(STORAGE_KEY, token.toLowerCase());
  } catch {
    /* private mode */
  }
  params.delete('gift');
  const search = params.toString();
  const path = window.location.pathname.startsWith('/gift/') ? '/' : window.location.pathname;
  const next = `${path}${search ? `?${search}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
}

export function readPendingGift(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? value.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function clearPendingGift() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function giftRedirectUrl(origin: string): string {
  const token = readPendingGift();
  return token ? `${origin}/?gift=${encodeURIComponent(token)}` : `${origin}/`;
}
