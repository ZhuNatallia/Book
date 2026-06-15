import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import {
  measurementConversions,
  tablespoonConversions,
  groceryDiscounts,
  groceryStores,
} from '../data/sampleRecipes';
import { supabase } from '../lib/supabase';
import { FullRecipe } from '../types';
import {
  Search,
  Store,
  Tag,
  Scale,
  Search as SearchIcon,
  Plus,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';

interface UtilitiesViewProps {
  recipes: FullRecipe[];
}

interface ConversionRow {
  id: string;
  name: { ru: string; en: string; de: string };
  cupWeight: number;
  tbspWeight: number;
  tspWeight: number;
  isCustom?: boolean;
}

interface CustomConversionDb {
  id: string;
  name_ru: string;
  name_en: string;
  name_de: string;
  cup_weight: number;
  tbsp_weight: number;
  tsp_weight: number;
}

function formatAmount(value: number): string {
  if (value >= 10) return Math.round(value).toString();
  if (value >= 1) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function UtilitiesView({ recipes }: UtilitiesViewProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [activeUtil, setActiveUtil] = useState<'converter' | 'fridge' | 'sales'>('converter');
  const [searchQuery, setSearchQuery] = useState('');
  const [fridgeQuery, setFridgeQuery] = useState('');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [customRows, setCustomRows] = useState<ConversionRow[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', cupWeight: '', tbspWeight: '', tspWeight: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const utilsTabs = [
    { id: 'converter' as const, icon: Scale, label: t('measurementConverter') },
    { id: 'fridge' as const, icon: SearchIcon, label: t('fridgeSearch') },
    { id: 'sales' as const, icon: Tag, label: t('salesTracker') },
  ];

  // Build base rows by merging cup and tbsp data
  const baseRows = useMemo<ConversionRow[]>(() => {
    return measurementConversions.map((item, idx) => {
      const tbspMatch = tablespoonConversions.find(
        (t) => t.name.ru === item.name.ru,
      );
      const tbspWeight = tbspMatch
        ? tbspMatch.weight
        : Math.round(item.weight / 16);
      const tspWeight = Math.round(tbspWeight / 3) || 1;
      return {
        id: `base-${idx}`,
        name: item.name,
        cupWeight: item.weight,
        tbspWeight,
        tspWeight,
      };
    });
  }, []);

  const allRows = useMemo(
    () => [...baseRows, ...customRows],
    [baseRows, customRows],
  );

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase();
    return allRows.filter(
      (r) =>
        r.name.ru.toLowerCase().includes(q) ||
        r.name.en.toLowerCase().includes(q) ||
        r.name.de.toLowerCase().includes(q),
    );
  }, [allRows, searchQuery]);

  const loadCustomConversions = useCallback(async () => {
    setLoadingCustom(true);
    const { data, error } = await supabase
      .from('custom_conversions')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setCustomRows(
        (data as CustomConversionDb[]).map((row) => ({
          id: row.id,
          name: { ru: row.name_ru, en: row.name_en, de: row.name_de },
          cupWeight: row.cup_weight,
          tbspWeight: row.tbsp_weight,
          tspWeight: row.tsp_weight,
          isCustom: true,
        })),
      );
    }
    setLoadingCustom(false);
  }, []);

  useEffect(() => {
    loadCustomConversions();
  }, [loadCustomConversions]);

  const handleAddCustom = async () => {
    const name = addForm.name.trim();
    const cup = parseFloat(addForm.cupWeight);
    if (!name || !cup || cup <= 0) return;

    const tbsp = addForm.tbspWeight
      ? parseFloat(addForm.tbspWeight)
      : Math.round(cup / 16);
    const tsp = addForm.tspWeight
      ? parseFloat(addForm.tspWeight)
      : Math.round(tbsp / 3) || 1;

    setSaving(true);
    const { data, error } = await supabase
      .from('custom_conversions')
      .insert({
        name_ru: name,
        name_en: name,
        name_de: name,
        cup_weight: cup,
        tbsp_weight: tbsp,
        tsp_weight: tsp,
      })
      .select()
      .single();

    if (!error && data) {
      const row = data as CustomConversionDb;
      setCustomRows((prev) => [
        ...prev,
        {
          id: row.id,
          name: { ru: row.name_ru, en: row.name_en, de: row.name_de },
          cupWeight: row.cup_weight,
          tbspWeight: row.tbsp_weight,
          tspWeight: row.tsp_weight,
          isCustom: true,
        },
      ]);
    }
    setSaving(false);
    setAddForm({ name: '', cupWeight: '', tbspWeight: '', tspWeight: '' });
    setShowAddForm(false);
  };

  const handleDeleteCustom = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase
      .from('custom_conversions')
      .delete()
      .eq('id', id);
    if (!error) {
      setCustomRows((prev) => prev.filter((r) => r.id !== id));
    }
    setDeletingId(null);
  };

  const getConversionResult = (row: ConversionRow, inputGrams: string) => {
    const grams = parseFloat(inputGrams);
    if (!grams || grams <= 0) return null;
    const cups = grams / row.cupWeight;
    const tbsp = grams / row.tbspWeight;
    const tsp = grams / row.tspWeight;
    return { cups, tbsp, tsp };
  };

  const getLabel = (key: string) => {
    const labels: Record<string, Record<string, string>> = {
      cup: { ru: 'ст.', en: 'cup', de: 'Ts.' },
      tbsp: { ru: 'ст.л.', en: 'tbsp', de: 'EL' },
      tsp: { ru: 'ч.л.', en: 'tsp', de: 'TL' },
      g: { ru: 'г', en: 'g', de: 'g' },
      enterVal: { ru: 'Ввести г/мл', en: 'Enter g/ml', de: 'g/ml eingeben' },
      result: { ru: 'Результат', en: 'Result', de: 'Ergebnis' },
      addProduct: { ru: 'Добавить продукт', en: 'Add product', de: 'Produkt hinzufügen' },
      productName: { ru: 'Название', en: 'Name', de: 'Name' },
      cupWeight: { ru: '1 стакан, г', en: '1 cup, g', de: '1 Tasse, g' },
      tbspWeight: { ru: '1 ст.л., г', en: '1 tbsp, g', de: '1 EL, g' },
      tspWeight: { ru: '1 ч.л., г', en: '1 tsp, g', de: '1 TL, g' },
      autoCalc: { ru: 'авто', en: 'auto', de: 'auto' },
      add: { ru: 'Добавить', en: 'Add', de: 'Hinzufügen' },
      cancel: { ru: 'Отмена', en: 'Cancel', de: 'Abbrechen' },
      search: { ru: 'Поиск продукта...', en: 'Search product...', de: 'Produkt suchen...' },
      colProduct: { ru: 'Продукт', en: 'Product', de: 'Produkt' },
      col1cup: { ru: '1 стакан', en: '1 cup', de: '1 Tasse' },
      col1tbsp: { ru: '1 ст.л.', en: '1 tbsp', de: '1 EL' },
      col1tsp: { ru: '1 ч.л.', en: '1 tsp', de: '1 TL' },
    };
    return labels[key]?.[language] ?? labels[key]?.en ?? key;
  };

  const getName = (row: ConversionRow) =>
    row.name[language as keyof typeof row.name] || row.name.en;

  // ---- Fridge search ----
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
      const recipeIngredients = recipe.ingredients.map((ing) => {
        const trans = ing.translations.find((tr) => tr.language === language);
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
        matches.push({
          recipe,
          matchCount,
          matchedIngredients: [...new Set(matchedIngredients)],
        });
      }
    });

    return matches.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5);
  }, [fridgeQuery, recipes, language]);

  // ---- Sales ----
  const matchedDiscounts = useMemo(() => {
    const ingredients = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        ing.translations.forEach((tr) => {
          ingredients.add(tr.name.toLowerCase());
        });
      });
    });

    return groceryDiscounts.filter((discount) => {
      return [...ingredients].some(
        (ing) =>
          ing.includes(discount.ingredientKeyword.toLowerCase()) ||
          discount.ingredientKeyword.toLowerCase().includes(ing),
      );
    });
  }, [recipes]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Tabs */}
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
                  : `${theme.bgCard} ${theme.textSecondary} border ${theme.border}`
              }`}
            >
              <Icon className="w-5 h-5" />
              {util.label}
            </button>
          );
        })}
      </div>

      {/* ============ CONVERTER ============ */}
      {activeUtil === 'converter' && (
        <div className={`${theme.bgCard} rounded-2xl shadow-sm border ${theme.border} overflow-hidden`}>
          {/* Header */}
          <div className={`p-4 border-b ${theme.border}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className={`w-5 h-5 ${theme.textAccent}`} />
                <h3 className={`font-bold ${theme.textPrimary}`}>{t('measurementConverter')}</h3>
              </div>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  showAddForm
                    ? `${theme.bgSecondary} ${theme.textSecondary} border ${theme.border}`
                    : `${theme.accentGradient} text-white shadow-sm`
                }`}
              >
                {showAddForm ? (
                  <><X className="w-4 h-4" />{getLabel('cancel')}</>
                ) : (
                  <><Plus className="w-4 h-4" />{getLabel('addProduct')}</>
                )}
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={getLabel('search')}
                className={`w-full pl-10 pr-4 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm ${theme.inputPlaceholder}`}
              />
            </div>

            {/* Add custom product form */}
            {showAddForm && (
              <div className={`mt-3 p-4 rounded-xl border ${theme.inputBorder} ${theme.bgSecondary} space-y-3`}>
                <p className={`text-sm font-semibold ${theme.textPrimary}`}>{getLabel('addProduct')}</p>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={getLabel('productName')}
                  className={`w-full px-3 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder} focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={`block text-xs ${theme.textSecondary} mb-1`}>{getLabel('cupWeight')}</label>
                    <input
                      type="number"
                      min="1"
                      value={addForm.cupWeight}
                      onChange={(e) => setAddForm((f) => ({ ...f, cupWeight: e.target.value }))}
                      placeholder="160"
                      className={`w-full px-3 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder} focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${theme.textSecondary} mb-1`}>
                      {getLabel('tbspWeight')} <span className={`${theme.textSecondary} opacity-60`}>({getLabel('autoCalc')})</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={addForm.tbspWeight}
                      onChange={(e) => setAddForm((f) => ({ ...f, tbspWeight: e.target.value }))}
                      placeholder={addForm.cupWeight ? String(Math.round(parseFloat(addForm.cupWeight || '0') / 16)) : '10'}
                      className={`w-full px-3 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder} focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${theme.textSecondary} mb-1`}>
                      {getLabel('tspWeight')} <span className={`${theme.textSecondary} opacity-60`}>({getLabel('autoCalc')})</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={addForm.tspWeight}
                      onChange={(e) => setAddForm((f) => ({ ...f, tspWeight: e.target.value }))}
                      placeholder={addForm.tbspWeight ? String(Math.round(parseFloat(addForm.tbspWeight || '0') / 3)) : '3'}
                      className={`w-full px-3 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder} focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddCustom}
                  disabled={saving || !addForm.name.trim() || !addForm.cupWeight}
                  className={`w-full py-2.5 ${theme.accentGradient} text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {getLabel('add')}
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px]">
              <thead>
                <tr className={`${theme.bgSecondary} border-b ${theme.border}`}>
                  <th className={`text-left px-4 py-3 text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[140px]`}>
                    {getLabel('colProduct')}
                  </th>
                  <th className={`text-center px-3 py-3 text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[90px]`}>
                    <div>{getLabel('col1cup')}</div>
                    <div className="text-[10px] font-normal opacity-60">240 мл</div>
                  </th>
                  <th className={`text-center px-3 py-3 text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[80px]`}>
                    <div>{getLabel('col1tbsp')}</div>
                    <div className="text-[10px] font-normal opacity-60">≈15 мл</div>
                  </th>
                  <th className={`text-center px-3 py-3 text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[80px]`}>
                    <div>{getLabel('col1tsp')}</div>
                    <div className="text-[10px] font-normal opacity-60">≈5 мл</div>
                  </th>
                  <th className={`text-left px-4 py-3 text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide`}>
                    {getLabel('enterVal')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                {loadingCustom && customRows.length === 0 && baseRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <Loader2 className={`w-6 h-6 animate-spin mx-auto ${theme.textAccent}`} />
                    </td>
                  </tr>
                )}
                {filteredRows.map((row) => {
                  const inputVal = customInputs[row.id] || '';
                  const result = getConversionResult(row, inputVal);
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-amber-50/40 dark:hover:bg-zinc-700/30 ${
                        row.isCustom ? `bg-orange-50/30 dark:bg-amber-900/10` : ''
                      }`}
                    >
                      {/* Product name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${theme.textPrimary}`}>
                            {getName(row)}
                          </span>
                          {row.isCustom && (
                            <button
                              onClick={() => handleDeleteCustom(row.id)}
                              disabled={deletingId === row.id}
                              className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 1 cup */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold ${theme.textAccent}`}>
                          {row.cupWeight}
                        </span>
                        <span className={`text-xs ${theme.textSecondary} ml-0.5`}>{getLabel('g')}</span>
                      </td>

                      {/* 1 tbsp */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold ${theme.textAccent}`}>
                          {row.tbspWeight}
                        </span>
                        <span className={`text-xs ${theme.textSecondary} ml-0.5`}>{getLabel('g')}</span>
                      </td>

                      {/* 1 tsp */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold ${theme.textAccent}`}>
                          {row.tspWeight}
                        </span>
                        <span className={`text-xs ${theme.textSecondary} ml-0.5`}>{getLabel('g')}</span>
                      </td>

                      {/* Custom input */}
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={inputVal}
                              onChange={(e) =>
                                setCustomInputs((prev) => ({
                                  ...prev,
                                  [row.id]: e.target.value,
                                }))
                              }
                              placeholder="0"
                              className={`w-20 px-2 py-1 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm text-center focus:ring-2 focus:ring-orange-500 focus:border-transparent ${theme.inputPlaceholder}`}
                            />
                            <span className={`text-xs ${theme.textSecondary}`}>{getLabel('g')}</span>
                          </div>
                          {result && (
                            <div className="space-y-0.5 text-xs">
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] ${theme.textSecondary} w-8`}>{getLabel('cup')}:</span>
                                <span className={`font-semibold ${theme.textAccent}`}>
                                  {formatAmount(result.cups)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] ${theme.textSecondary} w-8`}>{getLabel('tbsp')}:</span>
                                <span className={`font-semibold ${theme.textAccent}`}>
                                  {formatAmount(result.tbsp)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] ${theme.textSecondary} w-8`}>{getLabel('tsp')}:</span>
                                <span className={`font-semibold ${theme.textAccent}`}>
                                  {formatAmount(result.tsp)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && !loadingCustom && (
                  <tr>
                    <td colSpan={5} className={`py-8 text-center text-sm ${theme.textSecondary}`}>
                      {searchQuery
                        ? language === 'ru' ? 'Продукт не найден' : language === 'de' ? 'Produkt nicht gefunden' : 'Product not found'
                        : language === 'ru' ? 'Нет данных' : 'No data'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ FRIDGE SEARCH ============ */}
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
                {language === 'ru'
                  ? `${fridgeResults.length} рецептов найдено`
                  : language === 'de'
                    ? `${fridgeResults.length} Rezepte gefunden`
                    : `${fridgeResults.length} recipes found`}
              </p>
              {fridgeResults.map((result) => {
                const translation = result.recipe.translations.find(
                  (tr) => tr.language === language,
                );
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
                        {result.matchedIngredients.length > 3 &&
                          ` +${result.matchedIngredients.length - 3}`}
                      </p>
                    </div>
                    <div className="px-2 py-1 rounded-lg text-xs font-medium h-fit bg-green-50 text-green-600">
                      {result.matchCount}{' '}
                      {language === 'ru'
                        ? 'совпадений'
                        : language === 'de'
                          ? 'Treffer'
                          : 'matches'}
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

      {/* ============ SALES ============ */}
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
                    className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-blue-100"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 ${theme.bgSecondary} rounded-xl flex items-center justify-center border ${theme.border}`}
                        >
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
                      {t('validUntil')}:{' '}
                      {new Date(discount.validUntil).toLocaleDateString(
                        language === 'ru' ? 'ru-RU' : language === 'de' ? 'de-DE' : 'en-US',
                      )}
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
