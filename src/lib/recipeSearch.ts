import { FullRecipe } from '../types';

export function recipeMatchesQuery(recipe: FullRecipe, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  if (recipe.translations.some((tr) => {
    if (tr.title.toLowerCase().includes(query)) return true;
    if ((tr.description || '').toLowerCase().includes(query)) return true;
    return false;
  })) return true;

  if ((recipe.recipe.notes || '').toLowerCase().includes(query)) return true;

  if ((recipe.recipe.tags || []).some((tag) => tag.toLowerCase().includes(query))) return true;

  return recipe.ingredients.some((ing) =>
    ing.translations.some((tr) => tr.name.toLowerCase().includes(query)),
  );
}
