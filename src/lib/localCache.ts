import { FullRecipe, MealPlan, ShoppingItem } from '../types';

export type SyncJob =
  | { type: 'persistRecipe'; recipe: FullRecipe }
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
    }
  | { type: 'deleteRecipe'; recipeId: string }
  | { type: 'persistMealPlan'; plan: MealPlan };

export interface BookCache {
  recipes: FullRecipe[];
  shoppingList: ShoppingItem[];
  mealPlan: MealPlan;
  queue: SyncJob[];
}

export const EMPTY_MEAL_PLAN: MealPlan = { dayCount: 7, entries: [] };

function key(userId: string) {
  return `sr-book-${userId}`;
}

export function loadBookCache(userId: string): BookCache | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookCache;
    return {
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      shoppingList: Array.isArray(parsed.shoppingList) ? parsed.shoppingList : [],
      mealPlan: parsed.mealPlan ?? EMPTY_MEAL_PLAN,
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
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
    mealPlan: EMPTY_MEAL_PLAN,
    queue: [],
  };
}
