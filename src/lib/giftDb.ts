import { parseGiftInput } from './gift';
import { supabase } from './supabase';

export type GiftStatus =
  | 'ok'
  | 'ready'
  | 'already'
  | 'already_plus'
  | 'invalid'
  | 'expired'
  | 'exhausted'
  | 'email'
  | 'auth'
  | 'error';

export type GiftResult = {
  ok: boolean;
  status: GiftStatus;
  label?: string | null;
  days?: number;
};

function parseResult(data: unknown): GiftResult {
  if (!data || typeof data !== 'object') return { ok: false, status: 'error' };
  const row = data as { ok?: boolean; status?: string; label?: string; days?: number };
  const status = (row.status || 'error') as GiftStatus;
  return {
    ok: Boolean(row.ok),
    status,
    label: row.label ?? null,
    days: typeof row.days === 'number' ? row.days : undefined,
  };
}

export async function peekGift(token: string): Promise<GiftResult> {
  const { data, error } = await supabase.rpc('peek_gift', { p_token: parseGiftInput(token) });
  if (error) return { ok: false, status: 'error' };
  return parseResult(data);
}

export async function redeemGift(token: string): Promise<GiftResult> {
  const { data, error } = await supabase.rpc('redeem_gift', { p_token: parseGiftInput(token) });
  if (error) return { ok: false, status: 'error' };
  return parseResult(data);
}
