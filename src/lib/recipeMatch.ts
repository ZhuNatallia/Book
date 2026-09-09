import { FullRecipe } from '../types';
import { isSampleRecipeId } from './recipeDb';
import { normalizeSourceUrl } from './urlNorm';

export function normalizeRecipeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function titlesOf(full: FullRecipe): string[] {
  return full.translations
    .map((tr) => normalizeRecipeTitle(tr.title))
    .filter((title) => title.length >= 2);
}

export function findExistingRecipe(
  recipes: FullRecipe[],
  opts: {
    sourceUrl?: string;
    title?: string;
    imageUrl?: string;
    excludeId?: string;
  },
): FullRecipe | undefined {
  const source = opts.sourceUrl ? normalizeSourceUrl(opts.sourceUrl) : '';
  const title = opts.title ? normalizeRecipeTitle(opts.title) : '';
  const image =
    opts.imageUrl && /^https?:\/\//i.test(opts.imageUrl) ? opts.imageUrl : '';
  const own = recipes.filter(
    (full) =>
      (!opts.excludeId || full.recipe.id !== opts.excludeId) &&
      !isSampleRecipeId(full.recipe.id),
  );

  if (source) {
    const byUrl = own.find(
      (full) =>
        !!full.recipe.sourceUrl &&
        normalizeSourceUrl(full.recipe.sourceUrl) === source,
    );
    if (byUrl) return byUrl;
  }

  if (image) {
    const byImage = own.find((full) => full.recipe.imageUrl === image);
    if (byImage) return byImage;
  }

  if (title.length >= 2) {
    return own.find((full) => titlesOf(full).includes(title));
  }

  return undefined;
}
