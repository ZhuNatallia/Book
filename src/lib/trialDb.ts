import { supabase } from './supabase';

export type TrialStatus = 'ok' | 'already' | 'already_plus' | 'auth' | 'error';

export type TrialResult = {
  ok: boolean;
  status: TrialStatus;
  days?: number;
};

export async function startTrial(): Promise<TrialResult> {
  const { data, error } = await supabase.rpc('start_trial');
  if (error) return { ok: false, status: 'error' };
  if (!data || typeof data !== 'object') return { ok: false, status: 'error' };
  const row = data as { ok?: boolean; status?: string; days?: number };
  return {
    ok: Boolean(row.ok),
    status: (row.status || 'error') as TrialStatus,
    days: typeof row.days === 'number' ? row.days : 7,
  };
}
