import { useMemo, useState, type DragEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { FullRecipe, Language, MealPlan, MealPlanEntry, MealSlot } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { mergeIngredientLines } from '../lib/ingredientMerge';
import { addDaysISO, formatDayMonth, mondayISO, shiftWeek } from '../lib/week';

const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'pinch', 'cup'];
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const WEEKDAYS = ['weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri', 'weekdaySat', 'weekdaySun'];
const LOCALES: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  de: 'de-DE',
  uk: 'uk-UA',
  pl: 'pl-PL',
  it: 'it-IT',
  es: 'es-ES',
  fr: 'fr-FR',
  kk: 'kk-KZ',
};
const SLOT_KEYS: Record<MealSlot, string> = {
  breakfast: 'mealBreakfast',
  lunch: 'mealLunch',
  dinner: 'mealDinner',
  snack: 'mealSnack',
};

interface MealPlanViewProps {
  recipes: FullRecipe[];
  mealPlan: MealPlan;
  onChange: (plan: MealPlan) => void;
  onSendToShopping: (items: { name: string; quantity: number; unit: string }[]) => void;
}

function recipeTitle(recipe: FullRecipe, language: Language) {
  return (
    recipe.translations.find((tr) => tr.language === language)?.title ||
    recipe.translations.find((tr) => tr.language === 'ru')?.title ||
    recipe.translations[0]?.title ||
    ''
  );
}

function ingredientName(ingredient: FullRecipe['ingredients'][0], language: Language) {
  return (
    ingredient.translations.find((tr) => tr.language === language)?.name ||
    ingredient.translations.find((tr) => tr.language === 'ru')?.name ||
    ingredient.translations[0]?.name ||
    ''
  );
}

function entryServings(entry: MealPlanEntry, recipe?: FullRecipe) {
  return Math.max(1, entry.servings || recipe?.recipe.servings || 1);
}

export function MealPlanView({ recipes, mealPlan, onChange, onSendToShopping }: MealPlanViewProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showGrocery, setShowGrocery] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const byId = useMemo(() => {
    const map = new Map(recipes.map((r) => [r.recipe.id, r]));
    return map;
  }, [recipes]);

  const weekStart = mealPlan.weekStart || mondayISO();
  const pool = mealPlan.entries.filter((e) => e.dayIndex == null);

  const moveToDay = (entryId: string, dayIndex: number | null, mealSlot?: MealSlot | null) => {
    onChange({
      ...mealPlan,
      entries: mealPlan.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              dayIndex,
              mealSlot: dayIndex == null ? null : mealSlot ?? e.mealSlot ?? 'dinner',
            }
          : e,
      ),
    });
    setPickedId(null);
  };

  const removeEntry = (entryId: string) => {
    onChange({
      ...mealPlan,
      entries: mealPlan.entries.filter((e) => e.id !== entryId),
    });
  };

  const setDays = (count: number) => {
    onChange({
      ...mealPlan,
      dayCount: count,
      entries: mealPlan.entries.map((e) =>
        e.dayIndex != null && e.dayIndex >= count ? { ...e, dayIndex: null, mealSlot: null } : e,
      ),
    });
  };

  const changeWeek = (delta: number) => {
    onChange({
      ...mealPlan,
      weekStart: shiftWeek(weekStart, delta),
      entries: mealPlan.entries.map((e) =>
        e.dayIndex != null ? { ...e, dayIndex: null, mealSlot: null } : e,
      ),
    });
  };

  const setEntryServings = (entryId: string, servings: number) => {
    onChange({
      ...mealPlan,
      entries: mealPlan.entries.map((e) =>
        e.id === entryId ? { ...e, servings: Math.max(1, servings) } : e,
      ),
    });
  };

  const formatUnit = (unit: string) => {
    const u = unit.toLowerCase().trim();
    return UNIT_KEYS.includes(u) ? t(u) : unit;
  };

  const grocery = useMemo(() => {
    const lines: { name: string; quantity: number; unit: string }[] = [];
    for (const entry of mealPlan.entries) {
      if (entry.dayIndex == null) continue;
      const recipe = byId.get(entry.recipeId);
      if (!recipe) continue;
      const factor = entryServings(entry, recipe) / Math.max(1, recipe.recipe.servings || 1);
      for (const ing of recipe.ingredients) {
        const name = ingredientName(ing, language).trim();
        if (!name) continue;
        lines.push({
          name,
          quantity: (ing.quantity || 0) * factor,
          unit: ing.unit || '',
        });
      }
    }
    return mergeIngredientLines(lines).map((value) => ({
      key: `${value.name}|${value.unit}`,
      ...value,
    }));
  }, [mealPlan.entries, byId, language]);

  const openGrocery = () => {
    setSelectedKeys(new Set());
    setShowGrocery(true);
  };

  const allSelected = grocery.length > 0 && selectedKeys.size === grocery.length;

  const sendSelected = () => {
    const items = grocery.filter((g) => selectedKeys.has(g.key));
    onSendToShopping(items);
    setShowGrocery(false);
  };

  const duplicateToPool = (recipeId: string, servings?: number) => {
    const recipe = byId.get(recipeId);
    onChange({
      ...mealPlan,
      entries: [
        ...mealPlan.entries,
        {
          id: crypto.randomUUID(),
          recipeId,
          dayIndex: null,
          sortOrder: mealPlan.entries.length,
          servings: servings || recipe?.recipe.servings || 1,
          mealSlot: null,
        },
      ],
    });
  };

  const dayMacros = (entries: MealPlanEntry[]) => {
    let calories = 0;
    let protein = 0;
    let fat = 0;
    let carbs = 0;
    let any = false;
    for (const entry of entries) {
      const recipe = byId.get(entry.recipeId);
      if (!recipe) continue;
      const factor = entryServings(entry, recipe) / Math.max(1, recipe.recipe.servings || 1);
      const r = recipe.recipe;
      if (r.calories) {
        calories += r.calories * factor;
        any = true;
      }
      if (r.protein) {
        protein += r.protein * factor;
        any = true;
      }
      if (r.fat) {
        fat += r.fat * factor;
        any = true;
      }
      if (r.carbs) {
        carbs += r.carbs * factor;
        any = true;
      }
    }
    if (!any) return null;
    return { calories, protein, fat, carbs };
  };

  const renderChip = (entry: MealPlanEntry) => {
    const recipe = byId.get(entry.recipeId);
    const title = recipe ? recipeTitle(recipe, language) : entry.recipeId;
    const selected = pickedId === entry.id;
    const servings = entryServings(entry, recipe);
    return (
      <div
        key={entry.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', entry.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => {
          e.stopPropagation();
          setPickedId(selected ? null : entry.id);
        }}
        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${
          selected ? theme.chipActive : theme.chip
        }`}
      >
        <span className="line-clamp-2 text-left flex-1">{title}</span>
        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-1 opacity-60 hover:opacity-100"
            onClick={() => setEntryServings(entry.id, servings - 1)}
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs w-4 text-center">{servings}</span>
          <button
            type="button"
            className="p-1 opacity-60 hover:opacity-100"
            onClick={() => setEntryServings(entry.id, servings + 1)}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <button
          type="button"
          className="p-1 shrink-0 opacity-60 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            duplicateToPool(entry.recipeId, servings);
          }}
          title={t('addToMenu')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="p-1 shrink-0 opacity-60 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            removeEntry(entry.id);
          }}
          title={t('removeFromMenu')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const dropOn = (dayIndex: number | null, mealSlot?: MealSlot | null) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const entryId = e.dataTransfer.getData('text/plain');
    if (entryId) moveToDay(entryId, dayIndex, mealSlot);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 space-y-4">
      <div className={`${theme.card} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className={`w-5 h-5 ${theme.textAccent}`} />
          <h3 className={`font-bold ${theme.textPrimary}`}>{t('menu')}</h3>
        </div>
        <div className="flex items-center justify-between mb-3">
          <button type="button" className={theme.iconBtn} onClick={() => changeWeek(-1)} title={t('weekPrev')}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className={`text-sm font-medium ${theme.textPrimary}`}>
            {formatDayMonth(weekStart, LOCALES[language] || 'ru-RU')}
            {' — '}
            {formatDayMonth(addDaysISO(weekStart, 6), LOCALES[language] || 'ru-RU')}
          </p>
          <button type="button" className={theme.iconBtn} onClick={() => changeWeek(1)} title={t('weekNext')}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <p className={`text-sm ${theme.textSecondary} mb-2`}>{t('menuDays')}</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDays(n)}
              className={`w-10 h-10 text-base font-semibold ${mealPlan.dayCount === n ? theme.chipActive : theme.chip}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`${theme.card} p-4 min-h-[88px]`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={dropOn(null, null)}
        onClick={() => {
          if (pickedId) moveToDay(pickedId, null, null);
        }}
      >
        <p className={`text-sm font-semibold ${theme.textPrimary} mb-2`}>{t('menuPool')}</p>
        {pool.length === 0 ? (
          <p className={`text-sm ${theme.textSecondary}`}>{t('menuEmptyPool')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pool.map((e) => renderChip(e))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: mealPlan.dayCount }, (_, idx) => {
          const entries = mealPlan.entries.filter((e) => e.dayIndex === idx);
          const macros = dayMacros(entries);
          const dateIso = addDaysISO(weekStart, idx);
          return (
            <div
              key={idx}
              className={`${theme.card} p-3 min-h-[96px]`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={dropOn(idx, 'dinner')}
              onClick={() => {
                if (pickedId) moveToDay(pickedId, idx, 'dinner');
              }}
            >
              <p className={`text-sm font-semibold ${theme.textPrimary}`}>
                {t(WEEKDAYS[idx])} {formatDayMonth(dateIso, LOCALES[language] || 'ru-RU')}
              </p>
              {macros && (
                <p className={`text-xs ${theme.textSecondary} mb-2`}>
                  {Math.round(macros.calories)} {t('kcal')}
                  {macros.protein ? ` · ${t('proteinShort')} ${Math.round(macros.protein)}` : ''}
                  {macros.fat ? ` · ${t('fatShort')} ${Math.round(macros.fat)}` : ''}
                  {macros.carbs ? ` · ${t('carbsShort')} ${Math.round(macros.carbs)}` : ''}
                </p>
              )}
              {SLOTS.map((slot) => {
                const slotEntries = entries.filter((e) => (e.mealSlot || 'dinner') === slot);
                return (
                  <div
                    key={slot}
                    className="mt-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={dropOn(idx, slot)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pickedId) moveToDay(pickedId, idx, slot);
                    }}
                  >
                    <p className={`text-xs font-medium ${theme.textSecondary} mb-1`}>{t(SLOT_KEYS[slot])}</p>
                    {slotEntries.length === 0 ? (
                      <p className={`text-xs ${theme.textSecondary} opacity-50`}>·</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {slotEntries.map((e) => renderChip(e))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={openGrocery}
        className={`w-full py-3 ${theme.btnPrimary} font-semibold flex items-center justify-center gap-2`}
      >
        <ShoppingBag className="w-5 h-5" />
        {t('menuGrocery')}
      </button>

      {showGrocery && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className={`${theme.modalBg} w-full max-w-lg rounded-2xl p-4 max-h-[80vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-bold ${theme.textPrimary}`}>{t('menuGrocery')}</h3>
              <button type="button" onClick={() => setShowGrocery(false)} className={theme.iconBtn}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {grocery.length === 0 ? (
              <p className={theme.textSecondary}>{t('menuNoIngredients')}</p>
            ) : (
              <>
                <label className="mb-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelectedKeys(allSelected ? new Set() : new Set(grocery.map((g) => g.key)))
                    }
                  />
                  <span className={`text-sm font-medium ${theme.textPrimary}`}>{t('all')}</span>
                </label>
                <ul className="space-y-2 mb-4">
                  {grocery.map((item) => (
                    <li key={item.key}>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(item.key)}
                          onChange={() => {
                            const next = new Set(selectedKeys);
                            if (next.has(item.key)) next.delete(item.key);
                            else next.add(item.key);
                            setSelectedKeys(next);
                          }}
                        />
                        <span className={theme.textPrimary}>
                          {item.name}
                          {item.quantity ? ` — ${item.quantity} ${formatUnit(item.unit)}` : ''}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={selectedKeys.size === 0}
                  onClick={sendSelected}
                  className={`w-full py-3 ${theme.btnPrimary} font-semibold disabled:opacity-50`}
                >
                  {t('sendToShopping')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
