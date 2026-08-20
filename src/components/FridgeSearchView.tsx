import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe } from '../types';
import { Search, X } from 'lucide-react';

interface FridgeSearchViewProps {
  recipes: FullRecipe[];
  onOpenRecipe: (recipe: FullRecipe) => void;
  onClose?: () => void;
}

export function FridgeSearchView({ recipes, onOpenRecipe, onClose }: FridgeSearchViewProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [fridgeQuery, setFridgeQuery] = useState('');

  const fridgeResults = useMemo(() => {
    if (!fridgeQuery.trim()) return [];
    const ingredients = fridgeQuery
      .split(',')
      .map((i) => i.trim().toLowerCase())
      .filter(Boolean);

    const matches: {
      recipe: FullRecipe;
      matchCount: number;
      matchedIngredients: string[];
    }[] = [];

    recipes.forEach((recipe) => {
      const recipeIngredients = recipe.ingredients.flatMap((ing) =>
        ing.translations.map((tr) => tr.name.toLowerCase()).filter(Boolean),
      );

      const matchedIngredients: string[] = [];
      let matchCount = 0;

      ingredients.forEach((query) => {
        recipeIngredients.forEach((name) => {
          if (name.includes(query) || query.includes(name)) {
            matchCount++;
            matchedIngredients.push(name);
          }
        });
      });

      if (matchCount > 0) {
        matches.push({
          recipe,
          matchCount,
          matchedIngredients: [...new Set(matchedIngredients)],
        });
      }
    });

    return matches.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5);
  }, [fridgeQuery, recipes, language]);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className={`${theme.card} overflow-hidden`}>
        <div className={`p-4`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-green-500" />
              <h3 className={`font-bold ${theme.textPrimary}`}>{t('fridgeSearch')}</h3>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className={`p-1.5 rounded-full hover:bg-white/80 ${theme.textSecondary}`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <textarea
            value={fridgeQuery}
            onChange={(e) => setFridgeQuery(e.target.value)}
            placeholder={t('searchIngredients')}
            rows={3}
            className={`w-full px-4 py-3 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-base ${theme.inputPlaceholder}`}
          />
          <p className={`text-xs ${theme.textSecondary} mt-2`}>
            {t('fridgeHint')}
          </p>
        </div>

        {fridgeQuery && fridgeResults.length > 0 && (
          <div className="p-4 space-y-3">
            <p className={`text-base ${theme.textSecondary}`}>
              {`${fridgeResults.length} ${t('recipesFound')}`}
            </p>
            {fridgeResults.map((result) => {
              const translation =
                result.recipe.translations.find((tr) => tr.language === language) ||
                result.recipe.translations.find((tr) => tr.language === 'ru') ||
                result.recipe.translations[0];
              return (
                <div
                  key={result.recipe.recipe.id}
                  onClick={() => onOpenRecipe(result.recipe)}
                  className={`flex gap-3 p-3 ${theme.bgSecondary} rounded-xl hover:bg-gray-100 transition-colors cursor-pointer`}
                >
                  {result.recipe.recipe.imageUrl && (
                    <img
                      src={result.recipe.recipe.imageUrl}
                      alt={translation?.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium text-base ${theme.textPrimary}`}>{translation?.title}</p>
                    <p className="text-xs text-green-600 mt-1">
                      {result.matchedIngredients.slice(0, 3).join(', ')}
                      {result.matchedIngredients.length > 3 &&
                        ` +${result.matchedIngredients.length - 3}`}
                    </p>
                  </div>
                  <div className="px-2 py-1 rounded-lg text-xs font-medium h-fit bg-green-50 text-green-600">
                    {result.matchCount}{' '}
                    {t('matches')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {fridgeQuery && fridgeResults.length === 0 && (
          <div className={`p-8 text-center ${theme.textSecondary}`}>
            {t('noMatchingRecipes')}
          </div>
        )}
      </div>
    </div>
  );
}
