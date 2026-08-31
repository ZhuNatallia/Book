// Single source of truth for recipe categories. The header filter and the add-recipe form used
// to keep separate lists, which let recipes be saved into a category that had no filter button.
// Order matches the `categories` block in src/i18n/translations.ts.
export const RECIPE_CATEGORIES = [
	'meat',
	'poultry',
	'fish',
	'vegetables',
	'pizza',
	'pastry',
	'dessert',
	'creams',
	'sauces',
	'soup',
	'salad',
	'healthy',
	'preserves',
	'tips',
	'other',
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
