import { supabase } from './supabase';
import { MealPlan, MealPlanEntry, MealSlot } from '../types';
import { EMPTY_MEAL_PLAN } from './localCache';
import { isUuid } from './recipeDb';
import { mondayISO } from './week';

type EntryRow = {
  id: string;
  recipe_id: string;
  day_index: number | null;
  sort_order: number;
  servings: number | null;
  meal_slot: string | null;
};

function asSlot(value: string | null): MealSlot | null {
  if (value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack') {
    return value;
  }
  return null;
}

export async function fetchMealPlanUpdatedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.updated_at as string | undefined) ?? null;
}

export async function fetchMealPlan(userId: string): Promise<MealPlan> {
  const [{ data: plan, error: planError }, { data: entries, error: entriesError }] =
    await Promise.all([
      supabase
        .from('meal_plans')
        .select('user_id, day_count, updated_at, week_start')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('meal_plan_entries')
        .select('id, recipe_id, day_index, sort_order, servings, meal_slot')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    ]);
  if (planError) throw planError;
  if (entriesError) throw entriesError;

  return {
    dayCount: plan?.day_count ?? EMPTY_MEAL_PLAN.dayCount,
    weekStart: (plan?.week_start as string | undefined) || mondayISO(),
    updatedAt: (plan?.updated_at as string | undefined) ?? undefined,
    entries: ((entries ?? []) as EntryRow[]).map((row) => ({
      id: row.id,
      recipeId: row.recipe_id,
      dayIndex: row.day_index,
      sortOrder: row.sort_order,
      servings: row.servings ?? undefined,
      mealSlot: asSlot(row.meal_slot),
    })),
  };
}

export async function persistMealPlan(userId: string, plan: MealPlan): Promise<MealPlan> {
  const dayCount = Math.min(7, Math.max(1, plan.dayCount || 7));
  const weekStart = plan.weekStart || mondayISO();
  const updatedAt = new Date().toISOString();
  const { error: planError } = await supabase.from('meal_plans').upsert({
    user_id: userId,
    day_count: dayCount,
    week_start: weekStart,
    updated_at: updatedAt,
  });
  if (planError) throw planError;

  const { error: delError } = await supabase.from('meal_plan_entries').delete().eq('user_id', userId);
  if (delError) throw delError;

  const rows = plan.entries
    .filter((entry) => isUuid(entry.recipeId))
    .map((entry, idx) => ({
      id: isUuid(entry.id) ? entry.id : crypto.randomUUID(),
      user_id: userId,
      recipe_id: entry.recipeId,
      day_index: entry.dayIndex != null && entry.dayIndex < dayCount ? entry.dayIndex : null,
      sort_order: entry.sortOrder ?? idx,
      servings: entry.servings ?? null,
      meal_slot: entry.dayIndex == null ? null : (entry.mealSlot ?? null),
    }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('meal_plan_entries').insert(rows);
    if (insError) throw insError;
  }

  return {
    dayCount,
    weekStart,
    updatedAt,
    entries: rows.map((row) => ({
      id: row.id,
      recipeId: row.recipe_id,
      dayIndex: row.day_index,
      sortOrder: row.sort_order,
      servings: row.servings ?? undefined,
      mealSlot: asSlot(row.meal_slot),
    })) as MealPlanEntry[],
  };
}
