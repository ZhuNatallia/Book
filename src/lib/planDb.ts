import { supabase } from './supabase';
import { PlanId, PlanPeriod, SubscriptionRow } from './plan';

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const base = 'user_id, plan, period, valid_until, provider';
  const first = await supabase
    .from('subscriptions')
    .select(`${base}, trial_started_at`)
    .eq('user_id', userId)
    .maybeSingle();
  const { data, error } = first.error
    ? await supabase.from('subscriptions').select(base).eq('user_id', userId).maybeSingle()
    : first;
  if (error || !data) return null;
  const plan: PlanId = data.plan === 'plus' ? 'plus' : 'free';
  const period: PlanPeriod | null =
    data.period === 'month' || data.period === 'year' ? data.period : null;
  return {
    user_id: data.user_id,
    plan,
    period,
    valid_until: data.valid_until ?? null,
    provider: data.provider ?? null,
    trial_started_at:
      'trial_started_at' in data ? ((data as { trial_started_at?: string | null }).trial_started_at ?? null) : null,
  };
}

export async function countImportsThisMonth(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('recipe_imports')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStartIso());
  if (error) return 0;
  return count ?? 0;
}

export async function recordRecipeImport(userId: string, sourceUrl?: string): Promise<void> {
  const { error } = await supabase.from('recipe_imports').insert({
    user_id: userId,
    source_url: sourceUrl || null,
  });
  if (error) throw error;
}
