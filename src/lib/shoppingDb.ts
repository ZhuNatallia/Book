import { supabase } from './supabase';
import { ShoppingItem } from '../types';
import { isUuid } from './recipeDb';

type ItemRow = {
  id: string;
  ingredient_name: string;
  quantity: number | string | null;
  unit: string | null;
  recipe_id: string | null;
  checked: boolean;
  sort_order: number;
};

export async function fetchShoppingList(
  userId: string,
): Promise<{ items: ShoppingItem[]; updatedAt: string | null }> {
  const [{ data: head, error: headError }, { data: rows, error: itemsError }] =
    await Promise.all([
      supabase.from('shopping_lists').select('updated_at').eq('user_id', userId).maybeSingle(),
      supabase
        .from('shopping_items')
        .select('id, ingredient_name, quantity, unit, recipe_id, checked, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    ]);
  if (headError) throw headError;
  if (itemsError) throw itemsError;

  return {
    updatedAt: (head?.updated_at as string | undefined) ?? null,
    items: ((rows ?? []) as ItemRow[]).map((row) => ({
      id: row.id,
      ingredientName: row.ingredient_name,
      quantity: row.quantity != null ? Number(row.quantity) : undefined,
      unit: row.unit ?? undefined,
      recipeId: row.recipe_id ?? undefined,
      checked: !!row.checked,
    })),
  };
}

export async function fetchShoppingUpdatedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.updated_at as string | undefined) ?? null;
}

export async function persistShoppingList(
  userId: string,
  items: ShoppingItem[],
): Promise<{ items: ShoppingItem[]; updatedAt: string }> {
  const updatedAt = new Date().toISOString();
  const { error: headError } = await supabase.from('shopping_lists').upsert({
    user_id: userId,
    updated_at: updatedAt,
  });
  if (headError) throw headError;

  const { error: delError } = await supabase.from('shopping_items').delete().eq('user_id', userId);
  if (delError) throw delError;

  const rows = items.map((item, idx) => ({
    id: isUuid(item.id) ? item.id : crypto.randomUUID(),
    user_id: userId,
    ingredient_name: item.ingredientName,
    quantity: item.quantity ?? null,
    unit: item.unit || null,
    recipe_id: item.recipeId && isUuid(item.recipeId) ? item.recipeId : null,
    checked: item.checked,
    sort_order: idx,
  }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('shopping_items').insert(rows);
    if (insError) throw insError;
  }

  return {
    updatedAt,
    items: rows.map((row) => ({
      id: row.id,
      ingredientName: row.ingredient_name,
      quantity: row.quantity ?? undefined,
      unit: row.unit ?? undefined,
      recipeId: row.recipe_id ?? undefined,
      checked: row.checked,
    })),
  };
}
