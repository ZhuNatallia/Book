const STORAGE_KEY = 'plus-trial-offer';
const WAIT_AFTER_SIGNUP_MS = 7 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

type OfferState = {
  userId: string;
  dismissedAt: string;
};

function readState(userId: string): OfferState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as OfferState;
    if (!row || row.userId !== userId || !row.dismissedAt) return null;
    return row;
  } catch {
    return null;
  }
}

export function snoozeTrialOffer(userId: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userId, dismissedAt: new Date().toISOString() } satisfies OfferState),
    );
  } catch {
    /* private mode */
  }
}

export function shouldShowTrialOffer({
  userId,
  createdAt,
  isPlus,
  canStartTrial,
}: {
  userId: string;
  createdAt?: string | null;
  isPlus: boolean;
  canStartTrial: boolean;
}): boolean {
  if (isPlus || !canStartTrial) return false;
  if (createdAt) {
    const born = new Date(createdAt).getTime();
    if (Number.isFinite(born) && Date.now() - born < WAIT_AFTER_SIGNUP_MS) return false;
  }
  const state = readState(userId);
  if (!state) return true;
  const dismissed = new Date(state.dismissedAt).getTime();
  if (!Number.isFinite(dismissed)) return true;
  return Date.now() - dismissed >= SNOOZE_MS;
}
