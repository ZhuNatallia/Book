import { useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe, PantryItem } from '../types';
import { Search, X, Plus, Trash2 } from 'lucide-react';
import { stemIngredientName } from '../lib/ingredientMerge';

interface FridgeSearchViewProps {
  recipes: FullRecipe[];
  pantry: PantryItem[];
  onAddPantry: (name: string) => void;
  onRemovePantry: (id: string) => void;
  onOpenRecipe: (recipe: FullRecipe) => void;
  onClose?: () => void;
}

function ingredientLabel(language: string, ing: FullRecipe['ingredients'][0]) {
  return (
    ing.translations.find((tr) => tr.language === language)?.name ||
    ing.translations.find((tr) => tr.language === 'ru')?.name ||
    ing.translations[0]?.name ||
    ''
  );
}

export function FridgeSearchView({
  recipes,
  pantry,
  onAddPantry,
  onRemovePantry,
  onOpenRecipe,
  onClose,
}: FridgeSearchViewProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');

  const haveNames = useMemo(
    () => pantry.map((item) => item.name).filter(Boolean),
    [pantry],
  );

  const fridgeResults = useMemo(() => {
    if (haveNames.length === 0) return [];
    const haveStems = haveNames.map((name) => stemIngredientName(name)).filter(Boolean);

    const matches: {
      recipe: FullRecipe;
      coverage: number;
      have: string[];
      missing: string[];
    }[] = [];

    recipes.forEach((recipe) => {
      const unique = new Map<string, string>();
      recipe.ingredients.forEach((ing) => {
        const label = ingredientLabel(language, ing).trim();
        const stem = stemIngredientName(label);
        if (!stem || unique.has(stem)) return;
        unique.set(stem, label);
      });
      if (unique.size === 0) return;

      const have: string[] = [];
      const missing: string[] = [];
      unique.forEach((label, stem) => {
        const ok = haveStems.some(
          (query) => stem.includes(query) || query.includes(stem),
        );
        if (ok) have.push(label);
        else missing.push(label);
      });

      if (have.length === 0) return;
      matches.push({
        recipe,
        coverage: have.length / unique.size,
        have,
        missing,
      });
    });

    return matches.sort((a, b) => b.coverage - a.coverage);
  }, [haveNames, recipes, language]);

  const addDraft = () => {
    const parts = draft
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    parts.forEach((name) => onAddPantry(name));
    setDraft('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className={`${theme.card} overflow-hidden`}>
        <div className="p-4">
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
          <p className={`text-sm font-semibold ${theme.textPrimary} mb-2`}>{t('pantryTitle')}</p>
          <div className="flex items-center gap-2 mb-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addDraft();
              }}
              placeholder={t('searchIngredients')}
              className={`flex-1 px-4 py-3 text-base ${theme.input}`}
            />
            <button type="button" onClick={addDraft} className={`p-2 ${theme.iconBtn}`}>
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className={`text-xs ${theme.textSecondary} mb-3`}>{t('fridgeHint')}</p>
          {pantry.length === 0 ? (
            <p className={`text-sm ${theme.textSecondary}`}>{t('pantryEmpty')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {pantry.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm ${theme.chip}`}
                >
                  <span>
                    {item.name}
                    {item.quantity ? ` ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}
                  </span>
                  <button type="button" onClick={() => onRemovePantry(item.id)} className="opacity-60">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {haveNames.length > 0 && fridgeResults.length > 0 && (
          <div className="p-4 space-y-3">
            <p className={`text-base ${theme.textSecondary}`}>
              {`${fridgeResults.length} ${t('recipesFound')}`}
            </p>
            {fridgeResults.map((result) => {
              const translation =
                result.recipe.translations.find((tr) => tr.language === language) ||
                result.recipe.translations.find((tr) => tr.language === 'ru') ||
                result.recipe.translations[0];
              const pct = Math.round(result.coverage * 100);
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
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-base ${theme.textPrimary}`}>{translation?.title}</p>
                    {result.have.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        {t('fridgeHave')}: {result.have.slice(0, 4).join(', ')}
                        {result.have.length > 4 ? ` +${result.have.length - 4}` : ''}
                      </p>
                    )}
                    {result.missing.length > 0 && (
                      <p className={`text-xs mt-0.5 ${theme.textSecondary}`}>
                        {t('fridgeMissing')}: {result.missing.slice(0, 4).join(', ')}
                        {result.missing.length > 4 ? ` +${result.missing.length - 4}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="px-2 py-1 rounded-lg text-xs font-medium h-fit bg-green-50 text-green-600">
                    {pct}% {t('coverageLabel')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {haveNames.length > 0 && fridgeResults.length === 0 && (
          <div className={`p-8 text-center ${theme.textSecondary}`}>
            {t('noMatchingRecipes')}
          </div>
        )}
      </div>
    </div>
  );
}
