import { useMemo, useState, type DragEvent } from 'react';
import { CalendarDays, Plus, ShoppingBag, X } from 'lucide-react';
import { FullRecipe, Language, MealPlan } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { ingredientMergeKey, normalizeMergeUnit, pickDisplayName } from '../lib/ingredientMerge';

const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'cup'];

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

  const pool = mealPlan.entries.filter((e) => e.dayIndex == null);
  const days = Array.from({ length: mealPlan.dayCount }, (_, i) =>
    mealPlan.entries.filter((e) => e.dayIndex === i),
  );

  const moveToDay = (entryId: string, dayIndex: number | null) => {
    onChange({
      ...mealPlan,
      entries: mealPlan.entries.map((e) => (e.id === entryId ? { ...e, dayIndex } : e)),
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
        e.dayIndex != null && e.dayIndex >= count ? { ...e, dayIndex: null } : e,
      ),
    });
  };

  const formatUnit = (unit: string) => {
    const u = unit.toLowerCase().trim();
    return UNIT_KEYS.includes(u) ? t(u) : unit;
  };

  const grocery = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; unit: string }>();
    for (const entry of mealPlan.entries) {
      if (entry.dayIndex == null) continue;
      const recipe = byId.get(entry.recipeId);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const name = ingredientName(ing, language).trim();
        if (!name) continue;
        const unit = normalizeMergeUnit(ing.unit || '') || (ing.unit || '').trim();
        const key = ingredientMergeKey(name, unit);
        if (!key.split('|')[0]) continue;
        const prev = map.get(key);
        if (prev) {
          prev.quantity += ing.quantity || 0;
          prev.name = pickDisplayName(prev.name, name);
        } else {
          map.set(key, { name, quantity: ing.quantity || 0, unit });
        }
      }
    }
    return [...map.entries()].map(([key, value]) => ({ key, ...value }));
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

  const duplicateToPool = (recipeId: string) => {
    onChange({
      ...mealPlan,
      entries: [
        ...mealPlan.entries,
        {
          id: crypto.randomUUID(),
          recipeId,
          dayIndex: null,
          sortOrder: mealPlan.entries.length,
        },
      ],
    });
  };

  const renderChip = (entryId: string, recipeId: string) => {
    const recipe = byId.get(recipeId);
    const title = recipe ? recipeTitle(recipe, language) : recipeId;
    const selected = pickedId === entryId;
    return (
      <div
        key={entryId}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', entryId);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => {
          e.stopPropagation();
          setPickedId(selected ? null : entryId);
        }}
        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${
          selected ? theme.chipActive : theme.chip
        }`}
      >
        <span className="line-clamp-2 text-left flex-1">{title}</span>
        <button
          type="button"
          className="p-1 shrink-0 opacity-60 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            duplicateToPool(recipeId);
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
            removeEntry(entryId);
          }}
          title={t('removeFromMenu')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const dropOn = (dayIndex: number | null) => (e: DragEvent) => {
    e.preventDefault();
    const entryId = e.dataTransfer.getData('text/plain');
    if (entryId) moveToDay(entryId, dayIndex);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 space-y-4">
      <div className={`${theme.card} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className={`w-5 h-5 ${theme.textAccent}`} />
          <h3 className={`font-bold ${theme.textPrimary}`}>{t('menu')}</h3>
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
        onDrop={dropOn(null)}
        onClick={() => {
          if (pickedId) moveToDay(pickedId, null);
        }}
      >
        <p className={`text-sm font-semibold ${theme.textPrimary} mb-2`}>{t('menuPool')}</p>
        {pool.length === 0 ? (
          <p className={`text-sm ${theme.textSecondary}`}>{t('menuEmptyPool')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pool.map((e) => renderChip(e.id, e.recipeId))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {days.map((entries, idx) => (
          <div
            key={idx}
            className={`${theme.card} p-3 min-h-[96px]`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={dropOn(idx)}
            onClick={() => {
              if (pickedId) moveToDay(pickedId, idx);
            }}
          >
            <p className={`text-sm font-semibold ${theme.textPrimary} mb-2`}>
              {t('menuDay')} {idx + 1}
            </p>
            {entries.length === 0 ? (
              <p className={`text-xs ${theme.textSecondary}`}>{t('menuEmptyDay')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {entries.map((e) => renderChip(e.id, e.recipeId))}
              </div>
            )}
          </div>
        ))}
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
