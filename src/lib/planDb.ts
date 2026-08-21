import { supabase } from './supabase';
import { PlanId, PlanPeriod, SubscriptionRow } from './plan';

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id, plan, period, valid_until, provider')
    .eq('user_id', userId)
    .maybeSingle();
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
