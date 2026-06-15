import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { measurementConversions, tablespoonConversions, groceryDiscounts, groceryStores } from '../data/sampleRecipes';
import { FullRecipe } from '../types';
import { Search, Store, Tag, ArrowRight, Scale, Search as SearchIcon } from 'lucide-react';

interface UtilitiesViewProps {
  recipes: FullRecipe[];
}

export function UtilitiesView({ recipes }: UtilitiesViewProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [activeUtil, setActiveUtil] = useState<'converter' | 'fridge' | 'sales'>('converter');
  const [searchQuery, setSearchQuery] = useState('');
  const [fridgeQuery, setFridgeQuery] = useState('');

  const utilsTabs = [
    { id: 'converter' as const, icon: Scale, label: t('measurementConverter') },
    { id: 'fridge' as const, icon: SearchIcon, label: t('fridgeSearch') },
    { id: 'sales' as const, icon: Tag, label: t('salesTracker') },
  ];

  const getName = (item: { name: { [key: string]: string } }) => {
    return item.name[language] || item.name.en;
  };

  const filteredConversions = useMemo(() => {
    if (!searchQuery) return measurementConversions.slice(0, 8);
    const query = searchQuery.toLowerCase();
    return measurementConversions.filter(
      (c) =>
        c.name.ru.toLowerCase().includes(query) ||
        c.name.en.toLowerCase().includes(query) ||
        c.name.de.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const fridgeResults = useMemo(() => {
    if (!fridgeQuery.trim()) return [];
    const ingredients = fridgeQuery.split(',').map((i) => i.trim().toLowerCase()).filter(Boolean);

    const matches: { recipe: FullRecipe; matchCount: number; matchedIngredients: string[] }[] = [];

    recipes.forEach((recipe) => {
      const recipeIngredients = recipe.ingredients.map((ing) => {
        const trans = ing.translations.find((t) => t.language === language);
        return trans?.name.toLowerCase() || '';
      });

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
        matches.push({ recipe, matchCount, matchedIngredients: [...new Set(matchedIngredients)] });
      }
    });

    return matches.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5);
  }, [fridgeQuery, recipes, language]);

  const matchedDiscounts = useMemo(() => {
    const ingredients = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        ing.translations.forEach((t) => {
          ingredients.add(t.name.toLowerCase());
        });
      });
    });

    return groceryDiscounts.filter((discount) => {
      return [...ingredients].some((ing) =>
        ing.includes(discount.ingredientKeyword.toLowerCase()) ||
        discount.ingredientKeyword.toLowerCase().includes(ing)
      );
    });
  }, [recipes]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {utilsTabs.map((util) => {
          const Icon = util.icon;
          return (
            <button
              key={util.id}
              onClick={() => setActiveUtil(util.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-all ${
                activeUtil === util.id
                  ? `${theme.accentGradient} text-white shadow-md`
                  : `${theme.bgCard} ${theme.textSecondary} border ${theme.border} hover:${theme.borderAccent}`
              }`}
            >
              <Icon className="w-5 h-5" />
              {util.label}
            </button>
          );
        })}
      </div>

      {activeUtil === 'converter' && (
        <div className={`${theme.bgCard} rounded-2xl shadow-sm border ${theme.border} overflow-hidden`}>
          <div className={`p-4 border-b ${theme.border} bg-gradient-to-r from-amber-50 to-rose-50`}>
            <div className="flex items-center gap-2 mb-3">
              <Scale className={`w-5 h-5 ${theme.textAccent}`} />
              <h3 className={`font-bold ${theme.textPrimary}`}>{t('measurementConverter')}</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('measureSearch')}
                className={`w-full pl-10 pr-4 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm ${theme.inputPlaceholder}`}
              />
            </div>
          </div>

          <div className={`grid grid-cols-3 p-3 bg-gray-50 text-sm font-medium ${theme.textSecondary}`}>
            <div>{language === 'ru' ? '1 стакан' : language === 'de' ? '1 Tasse' : '1 cup'}</div>
            <div className="text-center">=</div>
            <div className="text-right">{t('g')}</div>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredConversions.map((conversion, idx) => (
              <div key={idx} className="grid grid-cols-3 p-3 hover:bg-amber-50/30 transition-colors">
                <div className={`font-medium ${theme.textPrimary}`}>{getName(conversion)}</div>
                <div className="text-center text-gray-400">
                  <ArrowRight className="w-4 h-4 inline" />
                </div>
                <div className="text-right">
                  <span className={`font-bold ${theme.textAccent}`}>{conversion.weight} г</span>
                </div>
              </div>
            ))}
          </div>

          <div className={`p-4 border-t ${theme.border} bg-gray-50`}>
            <p className={`font-medium ${theme.textPrimary} mb-3`}>
              {language === 'ru' ? '1 столовая ложка (15 мл):' : language === 'de' ? '1 Esslöffel (15 ml):' : '1 tablespoon (15 ml):'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tablespoonConversions.slice(0, 4).map((conv, idx) => (
                <div key={idx} className={`${theme.inputBg} ${theme.inputText} p-2 rounded-lg border ${theme.inputBorder} text-sm`}>
                  <span className={`font-medium ${theme.textSecondary}`}>{getName(conv)}</span>
                  <span className={`${theme.textAccent} font-bold ml-1`}>{conv.weight} г</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeUtil === 'fridge' && (
        <div className={`${theme.bgCard} rounded-2xl shadow-sm border ${theme.border} overflow-hidden`}>
          <div className={`p-4 border-b ${theme.border} bg-gradient-to-r from-green-50 to-emerald-50`}>
            <div className="flex items-center gap-2 mb-3">
              <SearchIcon className="w-5 h-5 text-green-500" />
              <h3 className={`font-bold ${theme.textPrimary}`}>{t('fridgeSearch')}</h3>
            </div>
            <textarea
              value={fridgeQuery}
              onChange={(e) => setFridgeQuery(e.target.value)}
              placeholder={t('searchIngredients')}
              rows={3}
              className={`w-full px-4 py-3 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm ${theme.inputPlaceholder}`}
            />
            <p className={`text-xs ${theme.textSecondary} mt-2`}>
              {language === 'ru'
                ? 'Введите ингредиенты через запятую, чтобы найти рецепты'
                : language === 'de'
                  ? 'Geben Sie Zutaten durch Kommas getrennt ein, um Rezepte zu finden'
                  : 'Enter ingredients separated by commas to find matching recipes'}
            </p>
          </div>

          {fridgeQuery && fridgeResults.length > 0 && (
            <div className="p-4 space-y-3">
              <p className={`text-sm ${theme.textSecondary}`}>
                {language === 'ru' ? `${fridgeResults.length} рецептов найдено` : language === 'de' ? `${fridgeResults.length} Rezepte gefunden` : `${fridgeResults.length} recipes found`}
              </p>

              {fridgeResults.map((result) => {
                const translation = result.recipe.translations.find((t) => t.language === language);
                return (
                  <div
                    key={result.recipe.recipe.id}
                    className={`flex gap-3 p-3 ${theme.bgSecondary} rounded-xl hover:bg-gray-100 transition-colors`}
                  >
                    {result.recipe.recipe.imageUrl && (
                      <img
                        src={result.recipe.recipe.imageUrl}
                        alt={translation?.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${theme.textPrimary}`}>{translation?.title}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {result.matchedIngredients.slice(0, 3).join(', ')}
                        {result.matchedIngredients.length > 3 && ` +${result.matchedIngredients.length - 3}`}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-xs font-medium h-fit bg-green-50 text-green-600`}>
                      {result.matchCount} {language === 'ru' ? 'совпадений' : language === 'de' ? 'Treffer' : 'matches'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fridgeQuery && fridgeResults.length === 0 && (
            <div className={`p-8 text-center ${theme.textSecondary}`}>
              {language === 'ru'
                ? 'Нет рецептов с подходящими ингредиентами'
                : language === 'de'
                  ? 'Keine Rezepte mit passenden Zutaten gefunden'
                  : 'No recipes match your ingredients'}
            </div>
          )}
        </div>
      )}

      {activeUtil === 'sales' && (
        <div className={`${theme.bgCard} rounded-2xl shadow-sm border ${theme.border} overflow-hidden`}>
          <div className={`p-4 border-b ${theme.border} bg-gradient-to-r from-blue-50 to-indigo-50`}>
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-500" />
              <h3 className={`font-bold ${theme.textPrimary}`}>{t('salesTracker')}</h3>
            </div>
            <p className={`text-sm ${theme.textSecondary} mt-1`}>
              {language === 'ru'
                ? 'Актуальные акции в магазинах на ваши ингредиенты'
                : language === 'de'
                  ? 'Aktuelle Angebote in Geschäften für Ihre Zutaten'
                  : 'Current discounts at stores for your ingredients'}
            </p>
          </div>

          {matchedDiscounts.length > 0 ? (
            <div className="p-4 space-y-3">
              {matchedDiscounts.map((discount) => {
                const store = groceryStores.find((s) => s.id === discount.storeId);
                return (
                  <div
                    key={discount.id}
                    className={`p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-blue-100`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 ${theme.bgSecondary} rounded-xl flex items-center justify-center border ${theme.border}`}>
                          <Store className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                          <p className={`font-bold ${theme.textPrimary}`}>{store?.name}</p>
                          <p className={`text-sm ${theme.textSecondary}`}>
                            {discount.ingredientKeyword}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-500">
                          -{discount.discountPercentage}%
                        </div>
                        <div className="text-sm line-through text-gray-400">
                          {discount.originalPrice}
                          {language === 'de' || language === 'en' ? ' €' : ' ₽'}
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          {discount.discountedPrice}
                          {language === 'de' || language === 'en' ? ' €' : ' ₽'}
                        </div>
                      </div>
                    </div>
                    <div className={`mt-2 text-xs ${theme.textSecondary}`}>
                      {t('validUntil')}: {new Date(discount.validUntil).toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'de' ? 'de-DE' : 'en-US')}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`p-8 text-center ${theme.textSecondary}`}>{t('noDiscounts')}</div>
          )}
        </div>
      )}
    </div>
  );
}
