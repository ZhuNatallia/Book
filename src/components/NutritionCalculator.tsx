import { useEffect, useMemo, useState } from 'react';
import { Flame, Loader2, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import type { FullRecipe } from '../types';
import type { NutritionPer100 } from '../data/nutrition';
import { buildLocalRows, lookupRemote, NutritionRow, perServing, rowNeedsLookup, sumRows } from '../lib/nutrition';

const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'pinch', 'cup'];

interface NutritionCalculatorProps {
  recipe: FullRecipe;
  onClose: () => void;
  onSave: (values: NutritionPer100) => void;
}

export function NutritionCalculator({ recipe, onClose, onSave }: NutritionCalculatorProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [rows, setRows] = useState<NutritionRow[]>(() => buildLocalRows(recipe, language));
  const [loading, setLoading] = useState(() => rows.some(rowNeedsLookup));
  const [lookupFailed, setLookupFailed] = useState(false);
  const servings = Number(recipe.recipe.servings) > 0 ? Number(recipe.recipe.servings) : 4;

  useEffect(() => {
    const initial = buildLocalRows(recipe, language);
    if (!initial.some(rowNeedsLookup)) return;
    let cancelled = false;
    lookupRemote(initial)
      .then(({ rows: found, failed }) => {
        if (cancelled) return;
        setRows((current) =>
          found.map((row, i) => (current[i]?.grams !== initial[i].grams ? { ...row, grams: current[i].grams } : row)),
        );
        setLookupFailed(failed);
      })
      .catch(() => !cancelled && setLookupFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Lookup runs once per opening; later edits are local to this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => sumRows(rows), [rows]);
  const portion = perServing(total, servings);

  const formatUnit = (unit: string) => {
    const u = unit.toLowerCase().trim();
    return UNIT_KEYS.includes(u) ? t(u) : unit;
  };

  const sourceLabel = (row: NutritionRow) =>
    row.source === 'local' ? t('nutritionSourceLocal') : row.source === 'usda' ? 'USDA' : t('nutritionSourceAi');

  const setGrams = (id: string, value: string) => {
    const n = Number(value.replace(',', '.'));
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, grams: value.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n } : row,
      ),
    );
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className={`${theme.modalBg} w-full max-w-lg rounded-2xl p-4 max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-bold ${theme.textPrimary}`}>{t('nutritionTitle')}</h3>
          <button type="button" onClick={onClose} className={theme.iconBtn} aria-label={t('cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`rounded-xl p-3 mb-3 ${theme.bgSecondary}`}>
          <p className={`text-xs mb-2 ${theme.textSecondary}`}>
            {t('nutritionCalcPerServing').replace('{n}', String(servings))}
          </p>
          <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
              <Flame className="w-4 h-4 text-orange-500" />
              {portion.kcal} {t('kcal')}
            </span>
            <span className="text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
              {`${t('proteinShort')}: ${portion.protein}${t('g')}`}
            </span>
            <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
              {`${t('fatShort')}: ${portion.fat}${t('g')}`}
            </span>
            <span className="text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20">
              {`${t('carbsShort')}: ${portion.carbs}${t('g')}`}
            </span>
          </div>
        </div>

        {loading && (
          <p className={`flex items-center gap-2 text-sm mb-2 ${theme.textSecondary}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('nutritionLoading')}
          </p>
        )}
        {lookupFailed && !loading && <p className="text-sm mb-2 text-red-600">{t('nutritionLookupFailed')}</p>}

        <ul className="space-y-2 overflow-y-auto flex-1 -mx-1 px-1">
          {rows.map((row) => {
            const pending = loading && rowNeedsLookup(row);
            const kcal =
              row.grams != null && row.per100 ? Math.round((row.per100.kcal * row.grams) / 100) : null;
            return (
              <li key={row.id} className={`rounded-xl p-2.5 ${theme.bgSecondary}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium break-words ${theme.textPrimary}`}>{row.name}</p>
                    <p className={`text-xs ${theme.textSecondary}`}>
                      {row.toTaste ? t('nutritionToTaste') : `${row.quantity} ${formatUnit(row.unit)}`}
                      {!row.toTaste && row.per100 && (
                        <>
                          {' · '}
                          {sourceLabel(row)} · {row.per100.kcal} {t('kcal')}/100{t('g')}
                        </>
                      )}
                    </p>
                    {!row.toTaste && !pending && !row.per100 && (
                      <p className="text-xs text-red-600">{t('nutritionNotFound')}</p>
                    )}
                    {!row.toTaste && !pending && row.per100 && row.grams == null && (
                      <p className="text-xs text-amber-600">{t('nutritionNeedWeight')}</p>
                    )}
                  </div>
                  {!row.toTaste && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <label className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={row.grams ?? ''}
                          disabled={pending}
                          onChange={(e) => setGrams(row.id, e.target.value)}
                          className={`w-20 px-2 py-1 text-right text-base ${theme.input}`}
                          aria-label={`${row.name}, ${t('g')}`}
                        />
                        <span className={`text-sm ${theme.textSecondary}`}>{t('g')}</span>
                      </label>
                      {pending ? (
                        <Loader2 className={`w-3.5 h-3.5 animate-spin ${theme.textSecondary}`} />
                      ) : (
                        kcal != null && (
                          <span className={`text-xs ${theme.textSecondary}`}>
                            {kcal} {t('kcal')}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className={`text-xs mt-3 ${theme.textSecondary}`}>{t('nutritionHint')}</p>
        <button
          type="button"
          disabled={loading || total.counted === 0}
          onClick={() => onSave(portion)}
          className={`w-full mt-3 py-3 ${theme.btnPrimary} font-semibold disabled:opacity-50`}
        >
          {t('nutritionSave')}
        </button>
      </div>
    </div>
  );
}
