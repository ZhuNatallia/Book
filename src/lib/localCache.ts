import { FullRecipe, MealPlan, PantryItem, ShoppingItem } from '../types';
import { mondayISO } from './week';

export type SyncJob =
  | { type: 'persistRecipe'; recipe: FullRecipe; touchedAt: string }
  | {
      type: 'updateFlags';
      recipeId: string;
      patch: {
        status?: 'want_to_cook' | 'cooked_liked';
        visibleToFriends?: boolean;
        lastCookedAt?: string | null;
        notes?: string | null;
        tags?: string[];
      };
      touchedAt: string;
    }
  | { type: 'deleteRecipe'; recipeId: string; touchedAt: string }
  | { type: 'persistMealPlan'; plan: MealPlan; touchedAt: string }
  | { type: 'persistShoppingList'; items: ShoppingItem[]; touchedAt: string }
  | { type: 'persistPantry'; items: PantryItem[]; touchedAt: string };

export interface LocalTouchedAt {
  recipes?: string;
  mealPlan?: string;
  shopping?: string;
  pantry?: string;
}

export interface BookCache {
  recipes: FullRecipe[];
  shoppingList: ShoppingItem[];
  pantry: PantryItem[];
  mealPlan: MealPlan;
  queue: SyncJob[];
  localTouchedAt: LocalTouchedAt;
}

export const EMPTY_MEAL_PLAN: MealPlan = {
  dayCount: 7,
  weekStart: mondayISO(),
  entries: [],
};

function key(userId: string) {
  return `sr-book-${userId}`;
}

function normalizePlan(plan: MealPlan | undefined): MealPlan {
  if (!plan) return { ...EMPTY_MEAL_PLAN, weekStart: mondayISO() };
  return {
    dayCount: plan.dayCount || 7,
    weekStart: plan.weekStart || mondayISO(),
    entries: Array.isArray(plan.entries) ? plan.entries : [],
    updatedAt: plan.updatedAt,
  };
}

export function loadBookCache(userId: string): BookCache | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookCache;
    return {
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      shoppingList: Array.isArray(parsed.shoppingList) ? parsed.shoppingList : [],
      pantry: Array.isArray(parsed.pantry) ? parsed.pantry : [],
      mealPlan: normalizePlan(parsed.mealPlan),
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      localTouchedAt: parsed.localTouchedAt ?? {},
    };
  } catch {
    return null;
  }
}

export function saveBookCache(userId: string, cache: BookCache) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(cache));
  } catch (err) {
    console.error(err);
  }
}

export function emptyBookCache(): BookCache {
  return {
    recipes: [],
    shoppingList: [],
    pantry: [],
    mealPlan: { ...EMPTY_MEAL_PLAN, weekStart: mondayISO() },
    queue: [],
    localTouchedAt: {},
  };
}
