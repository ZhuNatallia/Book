import { supabase } from './supabase';
import { PantryItem } from '../types';
import { isUuid } from './recipeDb';

type ItemRow = {
  id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  sort_order: number;
};

export async function fetchPantry(
  userId: string,
): Promise<{ items: PantryItem[]; updatedAt: string | null }> {
  const [{ data: head, error: headError }, { data: rows, error: itemsError }] =
    await Promise.all([
      supabase.from('pantry_lists').select('updated_at').eq('user_id', userId).maybeSingle(),
      supabase
        .from('pantry_items')
        .select('id, name, quantity, unit, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    ]);
  if (headError) throw headError;
  if (itemsError) throw itemsError;

  return {
    updatedAt: (head?.updated_at as string | undefined) ?? null,
    items: ((rows ?? []) as ItemRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity != null ? Number(row.quantity) : undefined,
      unit: row.unit ?? undefined,
    })),
  };
}

export async function fetchPantryUpdatedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('pantry_lists')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.updated_at as string | undefined) ?? null;
}

export async function persistPantry(
  userId: string,
  items: PantryItem[],
): Promise<{ items: PantryItem[]; updatedAt: string }> {
  const updatedAt = new Date().toISOString();
  const { error: headError } = await supabase.from('pantry_lists').upsert({
    user_id: userId,
    updated_at: updatedAt,
  });
  if (headError) throw headError;

  const { error: delError } = await supabase.from('pantry_items').delete().eq('user_id', userId);
  if (delError) throw delError;

  const rows = items.map((item, idx) => ({
    id: isUuid(item.id) ? item.id : crypto.randomUUID(),
    user_id: userId,
    name: item.name,
    quantity: item.quantity ?? null,
    unit: item.unit || null,
    sort_order: idx,
  }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('pantry_items').insert(rows);
    if (insError) throw insError;
  }

  return {
    updatedAt,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity ?? undefined,
      unit: row.unit ?? undefined,
    })),
  };
}
