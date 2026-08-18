import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import {
  measurementConversions,
  tablespoonConversions,
} from '../data/sampleRecipes';
import { Scale, Search, Plus, Trash2, RotateCcw, ArrowLeft } from 'lucide-react';

interface ConversionRow {
  id: string;
  name: { ru: string; en: string; de: string };
  cupWeight: number;
  tbspWeight: number;
  tspWeight: number;
  isCustom?: boolean;
}

function formatAmount(value: number): string {
  if (value >= 10) return Math.round(value).toString();
  if (value >= 1) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/\.?0+$/, '');
}

const STORAGE_KEY = 'smartrecipe_custom_conversions';

export function MeasurementConverterView() {
  const { language, t } = useLanguage();
  const { theme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [customRows, setCustomRows] = useState<ConversionRow[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as ConversionRow[]) : [];
    } catch {
      return [];
    }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', cupWeight: '', tbspWeight: '', tspWeight: '' });
  const [addError, setAddError] = useState<string | null>(null);

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

  const allRows = useMemo(() => {
    const lang = language as 'ru' | 'en' | 'de';
    const locale = lang === 'ru' ? 'ru' : lang === 'de' ? 'de' : 'en';
    return [...baseRows, ...customRows].sort((a, b) =>
      a.name[lang].localeCompare(b.name[lang], locale),
    );
  }, [baseRows, customRows, language]);

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

  const handleAddCustom = () => {
    const name = addForm.name.trim();
    const cup = parseFloat(addForm.cupWeight);
    if (!name || !cup || cup <= 0) return;

    const tbsp = addForm.tbspWeight
      ? parseFloat(addForm.tbspWeight)
      : Math.round(cup / 16);
    const tsp = addForm.tspWeight
      ? parseFloat(addForm.tspWeight)
      : Math.round(tbsp / 3) || 1;

    const newRow: ConversionRow = {
      id: crypto.randomUUID(),
      name: { ru: name, en: name, de: name },
      cupWeight: cup,
      tbspWeight: tbsp,
      tspWeight: tsp,
      isCustom: true,
    };

    setCustomRows((prev) => {
      const updated = [...prev, newRow];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setAddForm({ name: '', cupWeight: '', tbspWeight: '', tspWeight: '' });
    setShowAddForm(false);
    setAddError(null);
  };

  const handleDeleteCustom = (id: string) => {
    setCustomRows((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
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
      measurementConverter: { ru: 'Справочник мер', en: 'Measurement Reference', de: 'Maßreferenz' },
    };
    return labels[key]?.[language] ?? labels[key]?.en ?? key;
  };

  const getName = (row: ConversionRow) =>
    row.name[language as keyof typeof row.name] || row.name.en;

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 sm:p-4">
      <div className={`${theme.card} overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 border-b ${theme.border}`}>
          {showAddForm ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddError(null);
                }}
                className={`flex items-center gap-2 mb-3 ${theme.textSecondary}`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">{getLabel('measurementConverter')}</span>
              </button>
              <div className={`p-4 rounded-xl border ${theme.inputBorder} ${theme.bgSecondary} space-y-3`}>
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
                {addError && (
                  <p className="text-xs text-red-500 text-center">{addError}</p>
                )}
                <button
                  onClick={handleAddCustom}
                  disabled={!addForm.name.trim() || !addForm.cupWeight}
                  className={`w-full py-2.5 ${theme.btnPrimary} font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  {getLabel('add')}
                </button>
              </div>
            </>
          ) : (
            <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale className={`w-5 h-5 ${theme.textAccent}`} />
              <h3 className={`font-bold ${theme.textPrimary}`}>{getLabel('measurementConverter')}</h3>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${theme.btnPrimary}`}
            >
              <Plus className="w-4 h-4" />
              {getLabel('addProduct')}
            </button>
          </div>

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
            </>
          )}
        </div>

        {!showAddForm && (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className={`${theme.bgSecondary} border-b ${theme.border}`}>
                <th className={`text-left px-2 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[30%]`}>
                  {getLabel('colProduct')}
                </th>
                <th className={`text-center px-1 sm:px-3 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[16%]`}>
                  <div>{getLabel('col1cup')}</div>
                  <div className="text-[9px] sm:text-[10px] font-normal opacity-60">240 мл</div>
                </th>
                <th className={`text-center px-1 sm:px-3 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[16%]`}>
                  <div>{getLabel('col1tbsp')}</div>
                  <div className="text-[9px] sm:text-[10px] font-normal opacity-60">≈15 мл</div>
                </th>
                <th className={`text-center px-1 sm:px-3 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[16%]`}>
                  <div>{getLabel('col1tsp')}</div>
                  <div className="text-[9px] sm:text-[10px] font-normal opacity-60">≈5 мл</div>
                </th>
                <th className={`text-left px-1.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide w-[22%]`}>
                  {getLabel('enterVal')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
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
                    <td className="px-2 sm:px-4 py-2.5 sm:py-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`font-medium text-xs sm:text-sm ${theme.textPrimary} break-words leading-tight`}>
                          {getName(row)}
                        </span>
                        {row.isCustom && (
                          <button
                            onClick={() => handleDeleteCustom(row.id)}
                            className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                      {result ? (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-xs sm:text-sm font-bold text-emerald-600">
                            {formatAmount(result.cups)}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] ${theme.textSecondary}`}>{getLabel('cup')}</span>
                        </div>
                      ) : (
                        <div className="whitespace-nowrap">
                          <span className={`text-xs sm:text-sm font-bold ${theme.textAccent}`}>{row.cupWeight}</span>
                          <span className={`text-[10px] sm:text-xs ${theme.textSecondary} ml-0.5`}>{getLabel('g')}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                      {result ? (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-xs sm:text-sm font-bold text-emerald-600">
                            {formatAmount(result.tbsp)}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] ${theme.textSecondary}`}>{getLabel('tbsp')}</span>
                        </div>
                      ) : (
                        <div className="whitespace-nowrap">
                          <span className={`text-xs sm:text-sm font-bold ${theme.textAccent}`}>{row.tbspWeight}</span>
                          <span className={`text-[10px] sm:text-xs ${theme.textSecondary} ml-0.5`}>{getLabel('g')}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                      {result ? (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-xs sm:text-sm font-bold text-emerald-600">
                            {formatAmount(result.tsp)}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] ${theme.textSecondary}`}>{getLabel('tsp')}</span>
                        </div>
                      ) : (
                        <div className="whitespace-nowrap">
                          <span className={`text-xs sm:text-sm font-bold ${theme.textAccent}`}>{row.tspWeight}</span>
                          <span className={`text-[10px] sm:text-xs ${theme.textSecondary} ml-0.5`}>{getLabel('g')}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-1.5 sm:px-4 py-2">
                      <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0">
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
                          className={`w-12 sm:w-20 min-w-0 px-1 sm:px-2 py-1.5 ${theme.inputBg} ${theme.inputText} border ${
                            result ? 'border-emerald-400' : theme.inputBorder
                          } rounded-lg text-xs sm:text-sm text-center focus:ring-2 focus:ring-orange-500 focus:border-transparent ${theme.inputPlaceholder} transition-colors`}
                        />
                        <span className={`text-[10px] sm:text-xs ${theme.textSecondary} shrink-0`}>{getLabel('g')}</span>
                        {inputVal && (
                          <button
                            onClick={() =>
                              setCustomInputs((prev) => ({
                                ...prev,
                                [row.id]: '',
                              }))
                            }
                            title={t('reset')}
                            className="p-1 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors flex-shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className={`py-8 text-center text-sm ${theme.textSecondary}`}>
                    {searchQuery ? t('productNotFound') : t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
