/** Keep in sync with supabase/migrations/20260821170000_013_subscriptions.sql */
export const FREE_RECIPE_LIMIT = 30;
export const FREE_IMPORT_LIMIT = 5;
export const TRIAL_DAYS = 7;

export type PlanId = 'free' | 'plus';
export type PlanPeriod = 'month' | 'year';

export type SubscriptionRow = {
  user_id: string;
  plan: PlanId;
  period: PlanPeriod | null;
  valid_until: string | null;
  provider: string | null;
  trial_started_at: string | null;
};

export function isPlusActive(row: Pick<SubscriptionRow, 'plan' | 'valid_until'> | null): boolean {
  if (!row || row.plan !== 'plus' || !row.valid_until) return false;
  return new Date(row.valid_until).getTime() > Date.now();
}

export function isQuotaError(err: unknown): boolean {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : String(err ?? '');
  return msg.includes('recipe_limit_reached') || msg.includes('import_limit_reached');
}
