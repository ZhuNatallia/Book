import { supabase } from './supabase';
import { MealPlan, MealPlanEntry } from '../types';
import { EMPTY_MEAL_PLAN } from './localCache';
import { isUuid } from './recipeDb';

type EntryRow = {
  id: string;
  recipe_id: string;
  day_index: number | null;
  sort_order: number;
};

export async function fetchMealPlan(userId: string): Promise<MealPlan> {
  const [{ data: plan, error: planError }, { data: entries, error: entriesError }] =
    await Promise.all([
      supabase.from('meal_plans').select('user_id, day_count').eq('user_id', userId).maybeSingle(),
      supabase
        .from('meal_plan_entries')
        .select('id, recipe_id, day_index, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    ]);
  if (planError) throw planError;
  if (entriesError) throw entriesError;

  return {
    dayCount: plan?.day_count ?? EMPTY_MEAL_PLAN.dayCount,
    entries: ((entries ?? []) as EntryRow[]).map((row) => ({
      id: row.id,
      recipeId: row.recipe_id,
      dayIndex: row.day_index,
      sortOrder: row.sort_order,
    })),
  };
}

export async function persistMealPlan(userId: string, plan: MealPlan): Promise<MealPlan> {
  const dayCount = Math.min(7, Math.max(1, plan.dayCount || 7));
  const { error: planError } = await supabase.from('meal_plans').upsert({
    user_id: userId,
    day_count: dayCount,
    updated_at: new Date().toISOString(),
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
    }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('meal_plan_entries').insert(rows);
    if (insError) throw insError;
  }

  return {
    dayCount,
    entries: rows.map((row) => ({
      id: row.id,
      recipeId: row.recipe_id,
      dayIndex: row.day_index,
      sortOrder: row.sort_order,
    })) as MealPlanEntry[],
  };
}
