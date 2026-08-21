import { supabase } from './supabase';
import { isDataUrl, resolveRecipeImageForDb, removeRecipePhoto, uploadRecipePhoto } from './media';
import {
  FullRecipe,
  Language,
  RecipeIngredient,
  RecipeStep,
  IngredientTranslation,
  StepTranslation,
} from '../types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string) {
  return UUID_RE.test(id);
}

export function isSampleRecipeId(id: string) {
  return id.startsWith('sample-');
}

type TranslationRow = {
  id: string;
  language: string;
  title: string;
  description: string | null;
};

type IngredientRow = {
  id: string;
  quantity: number | string;
  unit: string;
  original_text: string | null;
  ingredient_translations: { id: string; language: string; name: string }[] | null;
};

type StepRow = {
  id: string;
  step_order: number;
  timer_minutes: number | null;
  step_translations: { id: string; language: string; instruction: string }[] | null;
};

type RecipeRow = {
  id: string;
  user_id: string | null;
  category: string;
  status: 'want_to_cook' | 'cooked_liked';
  image_url: string | null;
  source_url: string | null;
  servings: number;
  calories_per_serving: number | null;
  protein_per_serving: number | string | null;
  carbs_per_serving: number | string | null;
  fat_per_serving: number | string | null;
  visible_to_friends: boolean | null;
  notes: string | null;
  last_cooked_at: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  recipe_translations: TranslationRow[] | null;
  recipe_ingredients: IngredientRow[] | null;
  recipe_steps: StepRow[] | null;
};

const RECIPE_SELECT = `
  *,
  recipe_translations(*),
  recipe_ingredients(*, ingredient_translations(*)),
  recipe_steps(*, step_translations(*))
`;

function asLanguage(value: string): Language {
  return value as Language;
}

export function parseFiniteInput(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const s = String(value).trim().replace(/,/g, '.').replace(/[–—]/g, '-');
  if (/^nan$/i.test(s)) return undefined;
  const range = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const mid = (Number(range[1]) + Number(range[2])) / 2;
    return Number.isFinite(mid) ? Math.round(mid) : undefined;
  }
  const n = Number(s.match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) ? n : undefined;
}

function num(value: number | string | null | undefined): number | undefined {
  return parseFiniteInput(value);
}

export function mapRowToFullRecipe(row: RecipeRow): FullRecipe {
  const ingredients = (row.recipe_ingredients ?? []).map((ing) => ({
    id: ing.id,
    recipeId: row.id,
    quantity: Number(ing.quantity) || 0,
    unit: ing.unit,
    originalText: ing.original_text ?? undefined,
    translations: (ing.ingredient_translations ?? []).map((tr) => ({
      id: tr.id,
      ingredientId: ing.id,
      language: asLanguage(tr.language),
      name: tr.name,
    })) as IngredientTranslation[],
  })) as (RecipeIngredient & { translations: IngredientTranslation[] })[];

  const steps = (row.recipe_steps ?? [])
    .slice()
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => ({
      id: step.id,
      recipeId: row.id,
      stepOrder: step.step_order,
      timerMinutes: step.timer_minutes ?? undefined,
      translations: (step.step_translations ?? []).map((tr) => ({
        id: tr.id,
        stepId: step.id,
        language: asLanguage(tr.language),
        instruction: tr.instruction,
      })) as StepTranslation[],
    })) as (RecipeStep & { translations: StepTranslation[] })[];

  return {
    recipe: {
      id: row.id,
      userId: row.user_id ?? undefined,
      category: row.category,
      status: row.status,
      imageUrl: row.image_url ?? undefined,
      sourceUrl: row.source_url ?? undefined,
      servings: row.servings,
      calories: num(row.calories_per_serving),
      protein: num(row.protein_per_serving),
      fat: num(row.fat_per_serving),
      carbs: num(row.carbs_per_serving),
      visibleToFriends: row.visible_to_friends ?? false,
      notes: row.notes ?? undefined,
      lastCookedAt: row.last_cooked_at ?? undefined,
      tags: row.tags ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    translations: (row.recipe_translations ?? []).map((tr) => ({
      id: tr.id,
      recipeId: row.id,
      language: asLanguage(tr.language),
      title: tr.title,
      description: tr.description ?? undefined,
    })),
    ingredients,
    steps,
  };
}

export async function fetchRecipeUpdatedAt(recipeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('updated_at')
    .eq('id', recipeId)
    .maybeSingle();
  if (error) throw error;
  return (data?.updated_at as string | undefined) ?? null;
}

export async function fetchUserRecipes(userId: string): Promise<FullRecipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RecipeRow[]).map(mapRowToFullRecipe);
}

export async function fetchFriendVisibleRecipes(friendId: string): Promise<FullRecipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('user_id', friendId)
    .eq('visible_to_friends', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RecipeRow[]).map(mapRowToFullRecipe);
}

export function cloneRecipeForUser(full: FullRecipe, userId: string): FullRecipe {
  const now = new Date().toISOString();
  const recipeId = crypto.randomUUID();
  return {
    recipe: {
      ...full.recipe,
      id: recipeId,
      userId,
      status: 'want_to_cook',
      visibleToFriends: false,
      notes: undefined,
      lastCookedAt: undefined,
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    translations: full.translations.map((tr) => ({
      ...tr,
      id: crypto.randomUUID(),
      recipeId,
    })),
    ingredients: full.ingredients.map((ing) => {
      const ingredientId = crypto.randomUUID();
      return {
        ...ing,
        id: ingredientId,
        recipeId,
        translations: ing.translations.map((tr) => ({
          ...tr,
          id: crypto.randomUUID(),
          ingredientId,
        })),
      };
    }),
    steps: full.steps.map((step) => {
      const stepId = crypto.randomUUID();
      return {
        ...step,
        id: stepId,
        recipeId,
        translations: step.translations.map((tr) => ({
          ...tr,
          id: crypto.randomUUID(),
          stepId,
        })),
      };
    }),
  };
}

function pickLang<T extends { language: string }>(rows: T[], lang: string): T | undefined {
  return rows.find((r) => r.language === lang) || rows.find((r) => r.language === 'ru') || rows[0];
}

export async function translateCloneToLang(full: FullRecipe, lang: Language): Promise<FullRecipe> {
  const titleRow = pickLang(full.translations, lang);
  const ingredientNames = full.ingredients.map(
    (ing) => pickLang(ing.translations, lang)?.name ?? '',
  );
  const instructions = full.steps.map(
    (step) => pickLang(step.translations, lang)?.instruction ?? '',
  );

  const { data, error } = await supabase.functions.invoke('parse-recipe', {
    body: {
      lang,
      recipe: {
        title: titleRow?.title ?? '',
        description: titleRow?.description ?? '',
        ingredients: ingredientNames,
        instructions,
      },
    },
  });
  if (error || data?.error || !data) return full;

  const title = typeof data.title === 'string' ? data.title : titleRow?.title ?? '';
  const description = typeof data.description === 'string' ? data.description : titleRow?.description;
  const names: string[] = Array.isArray(data.ingredients) ? data.ingredients.map(String) : ingredientNames;
  const steps: string[] = Array.isArray(data.instructions) ? data.instructions.map(String) : instructions;

  return {
    ...full,
    translations: full.translations.map((tr) => ({ ...tr, title, description })),
    ingredients: full.ingredients.map((ing, i) => ({
      ...ing,
      translations: ing.translations.map((tr) => ({
        ...tr,
        name: names[i] ?? pickLang(ing.translations, lang)?.name ?? tr.name,
      })),
    })),
    steps: full.steps.map((step, i) => ({
      ...step,
      translations: step.translations.map((tr) => ({
        ...tr,
        instruction: steps[i] ?? pickLang(step.translations, lang)?.instruction ?? tr.instruction,
      })),
    })),
  };
}

export async function persistFullRecipe(userId: string, full: FullRecipe): Promise<FullRecipe> {
  const recipeId = isUuid(full.recipe.id) ? full.recipe.id : crypto.randomUUID();
  const now = new Date().toISOString();
  const r = full.recipe;
  const imageUrl = await resolveRecipeImageForDb(userId, recipeId, r.imageUrl);

  const { error: recipeError } = await supabase.from('recipes').upsert({
    id: recipeId,
    user_id: userId,
    category: r.category,
    status: r.status,
    image_url: imageUrl,
    source_url: r.sourceUrl || null,
    servings: r.servings,
    calories_per_serving: parseFiniteInput(r.calories) ?? null,
    protein_per_serving: parseFiniteInput(r.protein) ?? null,
    carbs_per_serving: parseFiniteInput(r.carbs) ?? null,
    fat_per_serving: parseFiniteInput(r.fat) ?? null,
    visible_to_friends: r.visibleToFriends ?? false,
    notes: r.notes || null,
    last_cooked_at: r.lastCookedAt || null,
    tags: r.tags ?? [],
    updated_at: now,
  });
  if (recipeError) throw recipeError;

  for (const tr of full.translations) {
    const { error } = await supabase.from('recipe_translations').upsert(
      {
        recipe_id: recipeId,
        language: tr.language,
        title: tr.title,
        description: tr.description || null,
      },
      { onConflict: 'recipe_id,language' },
    );
    if (error) throw error;
  }

  const { error: delIngError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId);
  if (delIngError) throw delIngError;

  const mappedIngredients = [];
  for (const ing of full.ingredients) {
    const ingredientId = crypto.randomUUID();
    const { error } = await supabase.from('recipe_ingredients').insert({
      id: ingredientId,
      recipe_id: recipeId,
      quantity: ing.quantity,
      unit: ing.unit,
      original_text: ing.originalText || ing.name || null,
    });
    if (error) throw error;

    const translations = ing.translations.map((tr) => ({
      ingredient_id: ingredientId,
      language: tr.language,
      name: tr.name,
    }));
    if (translations.length > 0) {
      const { error: trError } = await supabase.from('ingredient_translations').insert(translations);
      if (trError) throw trError;
    }

    mappedIngredients.push({
      ...ing,
      id: ingredientId,
      recipeId,
      translations: ing.translations.map((tr) => ({
        ...tr,
        ingredientId,
      })),
    });
  }

  const { error: delStepError } = await supabase
    .from('recipe_steps')
    .delete()
    .eq('recipe_id', recipeId);
  if (delStepError) throw delStepError;

  const mappedSteps = [];
  for (const step of full.steps) {
    const stepId = crypto.randomUUID();
    const { error } = await supabase.from('recipe_steps').insert({
      id: stepId,
      recipe_id: recipeId,
      step_order: step.stepOrder,
      timer_minutes: step.timerMinutes ?? null,
    });
    if (error) throw error;

    const translations = step.translations.map((tr) => ({
      step_id: stepId,
      language: tr.language,
      instruction: tr.instruction,
    }));
    if (translations.length > 0) {
      const { error: trError } = await supabase.from('step_translations').insert(translations);
      if (trError) throw trError;
    }

    mappedSteps.push({
      ...step,
      id: stepId,
      recipeId,
      translations: step.translations.map((tr) => ({
        ...tr,
        stepId,
      })),
    });
  }

  return {
    recipe: {
      ...r,
      id: recipeId,
      userId,
      imageUrl: imageUrl ?? undefined,
      visibleToFriends: r.visibleToFriends ?? false,
      notes: r.notes,
      lastCookedAt: r.lastCookedAt,
      tags: r.tags ?? [],
      updatedAt: now,
    },
    translations: full.translations.map((tr) => ({ ...tr, recipeId })),
    ingredients: mappedIngredients,
    steps: mappedSteps,
  };
}

export type RecipeFlagPatch = {
  status?: 'want_to_cook' | 'cooked_liked';
  visibleToFriends?: boolean;
  lastCookedAt?: string | null;
  notes?: string | null;
  tags?: string[];
};

export async function updateRecipeFlags(recipeId: string, patch: RecipeFlagPatch) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.visibleToFriends !== undefined) row.visible_to_friends = patch.visibleToFriends;
  if (patch.lastCookedAt !== undefined) row.last_cooked_at = patch.lastCookedAt;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.tags !== undefined) row.tags = patch.tags;
  const { error } = await supabase.from('recipes').update(row).eq('id', recipeId);
  if (error) throw error;
}

export async function deleteRemoteRecipe(recipeId: string, userId?: string) {
  if (userId) {
    try {
      await removeRecipePhoto(userId, recipeId);
    } catch (err) {
      console.error(err);
    }
  }
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
  if (error) throw error;
}

export async function migrateDataUrlRecipeImages(
  userId: string,
  recipes: FullRecipe[],
): Promise<FullRecipe[]> {
  const next: FullRecipe[] = [];
  let changed = false;
  for (const full of recipes) {
    const raw = full.recipe.imageUrl;
    if (!isDataUrl(raw) || !isUuid(full.recipe.id)) {
      next.push(full);
      continue;
    }
    try {
      const url = await uploadRecipePhoto(userId, full.recipe.id, raw);
      const { error } = await supabase
        .from('recipes')
        .update({ image_url: url, updated_at: new Date().toISOString() })
        .eq('id', full.recipe.id);
      if (error) throw error;
      next.push({ ...full, recipe: { ...full.recipe, imageUrl: url } });
      changed = true;
    } catch (err) {
      console.error(err);
      next.push(full);
    }
  }
  return changed ? next : recipes;
}
