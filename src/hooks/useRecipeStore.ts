import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FullRecipe,
  ShoppingItem,
  Language,
  MealPlan,
  MealPlanEntry,
  PantryItem,
} from '../types';
import { sampleRecipes } from '../data/sampleRecipes';
import {
  deleteRemoteRecipe,
  fetchUserRecipes,
  fetchRecipeUpdatedAt,
  isSampleRecipeId,
  isUuid,
  persistFullRecipe,
  cloneRecipeForUser,
  translateCloneToLang,
  updateRecipeFlags,
  RecipeFlagPatch,
} from '../lib/recipeDb';
import { fetchMealPlan, fetchMealPlanUpdatedAt, persistMealPlan } from '../lib/mealPlanDb';
import {
  fetchShoppingList,
  fetchShoppingUpdatedAt,
  persistShoppingList,
} from '../lib/shoppingDb';
import { fetchPantry, fetchPantryUpdatedAt, persistPantry } from '../lib/pantryDb';
import {
  BookCache,
  EMPTY_MEAL_PLAN,
  LocalTouchedAt,
  SyncJob,
  emptyBookCache,
  loadBookCache,
  saveBookCache,
} from '../lib/localCache';
import { ingredientMergeKey, mergeQtyUnit, pickDisplayName } from '../lib/ingredientMerge';
import { mondayISO } from '../lib/week';

const SNAPSHOT_TYPES = new Set<SyncJob['type']>([
  'persistMealPlan',
  'persistShoppingList',
  'persistPantry',
]);

function nowIso() {
  return new Date().toISOString();
}

function mergeByNameUnit(
  prev: ShoppingItem[],
  name: string,
  quantity: number,
  unit: string,
  recipeId?: string,
): ShoppingItem[] {
  const key = ingredientMergeKey(name, unit);
  const existing = prev.find(
    (item) => ingredientMergeKey(item.ingredientName, item.unit || '') === key,
  );
  if (existing) {
    const merged = mergeQtyUnit(existing.quantity || 0, existing.unit || '', quantity, unit);
    return prev.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            quantity: merged.quantity,
            unit: merged.unit,
            ingredientName: pickDisplayName(item.ingredientName, name),
          }
        : item,
    );
  }
  const pretty = mergeQtyUnit(quantity, unit, 0, unit);
  return [
    ...prev,
    {
      id: crypto.randomUUID(),
      ingredientName: name,
      quantity: pretty.quantity,
      unit: pretty.unit || unit,
      recipeId,
      checked: false,
    },
  ];
}

function applyPendingJobs(recipes: FullRecipe[], jobs: SyncJob[]): FullRecipe[] {
  let next = recipes;
  for (const job of jobs) {
    if (job.type === 'persistRecipe') {
      const id = job.recipe.recipe.id;
      if (next.some((r) => r.recipe.id === id)) {
        next = next.map((r) => (r.recipe.id === id ? job.recipe : r));
      } else {
        next = [...next, job.recipe];
      }
    } else if (job.type === 'updateFlags') {
      next = next.map((r) => {
        if (r.recipe.id !== job.recipeId) return r;
        return {
          ...r,
          recipe: {
            ...r.recipe,
            ...(job.patch.status !== undefined ? { status: job.patch.status } : {}),
            ...(job.patch.visibleToFriends !== undefined
              ? { visibleToFriends: job.patch.visibleToFriends }
              : {}),
            ...(job.patch.lastCookedAt !== undefined
              ? { lastCookedAt: job.patch.lastCookedAt ?? undefined }
              : {}),
            ...(job.patch.notes !== undefined ? { notes: job.patch.notes ?? undefined } : {}),
            ...(job.patch.tags !== undefined ? { tags: job.patch.tags } : {}),
          },
        };
      });
    } else if (job.type === 'deleteRecipe') {
      next = next.filter((r) => r.recipe.id !== job.recipeId);
    }
  }
  return next;
}

function hasJob(jobs: SyncJob[], type: SyncJob['type']) {
  return jobs.some((j) => j.type === type);
}

function hasRecipeJobs(jobs: SyncJob[]) {
  return jobs.some(
    (j) => j.type === 'persistRecipe' || j.type === 'updateFlags' || j.type === 'deleteRecipe',
  );
}

function newer(serverAt: string | null, localAt: string | undefined) {
  if (!serverAt || !localAt) return false;
  return serverAt > localAt;
}

export function useRecipeStore(userId?: string) {
  const [recipes, setRecipes] = useState<FullRecipe[]>(() => {
    if (!userId) return sampleRecipes;
    const cache = loadBookCache(userId);
    return cache ? [...sampleRecipes, ...cache.recipes] : sampleRecipes;
  });
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    if (!userId) return [];
    return loadBookCache(userId)?.shoppingList ?? [];
  });
  const [pantry, setPantry] = useState<PantryItem[]>(() => {
    if (!userId) return [];
    return loadBookCache(userId)?.pantry ?? [];
  });
  const [mealPlan, setMealPlan] = useState<MealPlan>(() => {
    if (!userId) return { ...EMPTY_MEAL_PLAN, weekStart: mondayISO() };
    return loadBookCache(userId)?.mealPlan ?? { ...EMPTY_MEAL_PLAN, weekStart: mondayISO() };
  });
  const [syncing, setSyncing] = useState(false);
  const queueRef = useRef<SyncJob[]>(userId ? loadBookCache(userId)?.queue ?? [] : []);
  const touchedRef = useRef<LocalTouchedAt>(
    userId ? loadBookCache(userId)?.localTouchedAt ?? {} : {},
  );
  const recipesRef = useRef(recipes);
  const shoppingRef = useRef(shoppingList);
  const pantryRef = useRef(pantry);
  const mealPlanRef = useRef(mealPlan);
  recipesRef.current = recipes;
  shoppingRef.current = shoppingList;
  pantryRef.current = pantry;
  mealPlanRef.current = mealPlan;

  const persistCache = useCallback(() => {
    if (!userId) return;
    const cache: BookCache = {
      recipes: recipesRef.current.filter((r) => !isSampleRecipeId(r.recipe.id)),
      shoppingList: shoppingRef.current,
      pantry: pantryRef.current,
      mealPlan: mealPlanRef.current,
      queue: queueRef.current,
      localTouchedAt: touchedRef.current,
    };
    saveBookCache(userId, cache);
  }, [userId]);

  const enqueue = useCallback(
    (job: SyncJob) => {
      if (SNAPSHOT_TYPES.has(job.type)) {
        queueRef.current = [...queueRef.current.filter((j) => j.type !== job.type), job];
      } else {
        queueRef.current = [...queueRef.current, job];
      }
      persistCache();
    },
    [persistCache],
  );

  const touch = useCallback((entity: keyof LocalTouchedAt) => {
    touchedRef.current = { ...touchedRef.current, [entity]: nowIso() };
  }, []);

  const flushQueue = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    const jobs = [...queueRef.current];
    if (jobs.length === 0) return;
    setSyncing(true);
    const remaining: SyncJob[] = [];
    for (const job of jobs) {
      try {
        if (job.type === 'persistRecipe') {
          const serverAt = isUuid(job.recipe.recipe.id)
            ? await fetchRecipeUpdatedAt(job.recipe.recipe.id)
            : null;
          if (newer(serverAt, job.touchedAt)) {
            remaining.push(job);
            continue;
          }
          await persistFullRecipe(userId, job.recipe);
        } else if (job.type === 'updateFlags') {
          const serverAt = await fetchRecipeUpdatedAt(job.recipeId);
          if (newer(serverAt, job.touchedAt)) {
            remaining.push(job);
            continue;
          }
          await updateRecipeFlags(job.recipeId, job.patch);
        } else if (job.type === 'deleteRecipe') {
          await deleteRemoteRecipe(job.recipeId);
        } else if (job.type === 'persistMealPlan') {
          const serverAt = await fetchMealPlanUpdatedAt(userId);
          if (newer(serverAt, job.touchedAt)) {
            remaining.push(job);
            continue;
          }
          await persistMealPlan(userId, job.plan);
        } else if (job.type === 'persistShoppingList') {
          const serverAt = await fetchShoppingUpdatedAt(userId);
          if (newer(serverAt, job.touchedAt)) {
            remaining.push(job);
            continue;
          }
          await persistShoppingList(userId, job.items);
        } else if (job.type === 'persistPantry') {
          const serverAt = await fetchPantryUpdatedAt(userId);
          if (newer(serverAt, job.touchedAt)) {
            remaining.push(job);
            continue;
          }
          await persistPantry(userId, job.items);
        }
      } catch {
        remaining.push(job);
      }
    }
    queueRef.current = remaining;
    persistCache();
    setSyncing(false);
  }, [userId, persistCache]);

  const runRemote = useCallback(
    async (job: SyncJob) => {
      if (!userId) return;
      if (!navigator.onLine) {
        enqueue(job);
        return;
      }
      try {
        if (job.type === 'persistRecipe') {
          const serverAt = isUuid(job.recipe.recipe.id)
            ? await fetchRecipeUpdatedAt(job.recipe.recipe.id)
            : null;
          if (newer(serverAt, job.touchedAt)) {
            enqueue(job);
            return;
          }
          const saved = await persistFullRecipe(userId, job.recipe);
          setRecipes((prev) =>
            prev.map((r) =>
              r.recipe.id === job.recipe.recipe.id || r.recipe.id === saved.recipe.id ? saved : r,
            ),
          );
        } else if (job.type === 'updateFlags') {
          const serverAt = await fetchRecipeUpdatedAt(job.recipeId);
          if (newer(serverAt, job.touchedAt)) {
            enqueue(job);
            return;
          }
          await updateRecipeFlags(job.recipeId, job.patch);
        } else if (job.type === 'deleteRecipe') {
          await deleteRemoteRecipe(job.recipeId);
        } else if (job.type === 'persistMealPlan') {
          const serverAt = await fetchMealPlanUpdatedAt(userId);
          if (newer(serverAt, job.touchedAt)) {
            enqueue(job);
            return;
          }
          await persistMealPlan(userId, job.plan);
        } else if (job.type === 'persistShoppingList') {
          const serverAt = await fetchShoppingUpdatedAt(userId);
          if (newer(serverAt, job.touchedAt)) {
            enqueue(job);
            return;
          }
          await persistShoppingList(userId, job.items);
        } else if (job.type === 'persistPantry') {
          const serverAt = await fetchPantryUpdatedAt(userId);
          if (newer(serverAt, job.touchedAt)) {
            enqueue(job);
            return;
          }
          await persistPantry(userId, job.items);
        }
      } catch {
        enqueue(job);
      }
    },
    [userId, enqueue],
  );

  useEffect(() => {
    persistCache();
  }, [recipes, shoppingList, pantry, mealPlan, persistCache]);

  const skipMeal = useRef(true);
  const skipShop = useRef(true);
  const skipPantry = useRef(true);
  useEffect(() => {
    skipMeal.current = true;
    skipShop.current = true;
    skipPantry.current = true;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (skipMeal.current) {
      skipMeal.current = false;
      return;
    }
    const touchedAt = nowIso();
    touchedRef.current = { ...touchedRef.current, mealPlan: touchedAt };
    const timer = window.setTimeout(() => {
      void runRemote({ type: 'persistMealPlan', plan: mealPlan, touchedAt });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [mealPlan, userId, runRemote]);

  useEffect(() => {
    if (!userId) return;
    if (skipShop.current) {
      skipShop.current = false;
      return;
    }
    const touchedAt = nowIso();
    touchedRef.current = { ...touchedRef.current, shopping: touchedAt };
    const timer = window.setTimeout(() => {
      void runRemote({ type: 'persistShoppingList', items: shoppingList, touchedAt });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [shoppingList, userId, runRemote]);

  useEffect(() => {
    if (!userId) return;
    if (skipPantry.current) {
      skipPantry.current = false;
      return;
    }
    const touchedAt = nowIso();
    touchedRef.current = { ...touchedRef.current, pantry: touchedAt };
    const timer = window.setTimeout(() => {
      void runRemote({ type: 'persistPantry', items: pantry, touchedAt });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [pantry, userId, runRemote]);

  useEffect(() => {
    if (!userId) {
      setRecipes(sampleRecipes);
      setShoppingList([]);
      setPantry([]);
      setMealPlan({ ...EMPTY_MEAL_PLAN, weekStart: mondayISO() });
      queueRef.current = [];
      touchedRef.current = {};
      return;
    }
    const cached = loadBookCache(userId) ?? emptyBookCache();
    queueRef.current = cached.queue;
    touchedRef.current = cached.localTouchedAt;
    setRecipes([...sampleRecipes, ...cached.recipes]);
    setShoppingList(cached.shoppingList);
    setPantry(cached.pantry);
    setMealPlan(cached.mealPlan);

    let cancelled = false;
    (async () => {
      try {
        await flushQueue();
        const [remoteRes, planRes, shopRes, pantryRes] = await Promise.allSettled([
          fetchUserRecipes(userId),
          fetchMealPlan(userId),
          fetchShoppingList(userId),
          fetchPantry(userId),
        ]);
        if (cancelled) return;
        const jobs = queueRef.current;
        if (remoteRes.status === 'fulfilled') {
          const remote = remoteRes.value;
          if (hasRecipeJobs(jobs)) {
            setRecipes([...sampleRecipes, ...applyPendingJobs(remote, jobs)]);
          } else {
            setRecipes([...sampleRecipes, ...remote]);
          }
        }
        if (planRes.status === 'fulfilled' && !hasJob(jobs, 'persistMealPlan')) {
          skipMeal.current = true;
          setMealPlan(planRes.value);
          if (planRes.value.updatedAt) {
            touchedRef.current = { ...touchedRef.current, mealPlan: planRes.value.updatedAt };
          }
        }
        if (shopRes.status === 'fulfilled' && !hasJob(jobs, 'persistShoppingList')) {
          skipShop.current = true;
          setShoppingList(shopRes.value.items);
          if (shopRes.value.updatedAt) {
            touchedRef.current = { ...touchedRef.current, shopping: shopRes.value.updatedAt };
          }
        }
        if (pantryRes.status === 'fulfilled' && !hasJob(jobs, 'persistPantry')) {
          skipPantry.current = true;
          setPantry(pantryRes.value.items);
          if (pantryRes.value.updatedAt) {
            touchedRef.current = { ...touchedRef.current, pantry: pantryRes.value.updatedAt };
          }
        }
        persistCache();
      } catch (err) {
        console.error(err);
      }
    })();

    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, [userId, flushQueue, persistCache]);

  const addRecipe = useCallback(
    (recipe: FullRecipe) => {
      setRecipes((prev) => [...prev, recipe]);
      if (!userId || isSampleRecipeId(recipe.recipe.id)) return;
      touch('recipes');
      void runRemote({ type: 'persistRecipe', recipe, touchedAt: nowIso() });
    },
    [userId, runRemote, touch],
  );

  const copyRecipe = useCallback(
    async (full: FullRecipe, lang: Language) => {
      if (!userId) return;
      const clone = cloneRecipeForUser(full, userId);
      let toSave = clone;
      try {
        if (navigator.onLine) {
          toSave = await translateCloneToLang(clone, lang);
        }
      } catch (err) {
        console.error(err);
      }
      addRecipe(toSave);
    },
    [userId, addRecipe],
  );

  const updateRecipe = useCallback(
    (updatedRecipe: FullRecipe) => {
      setRecipes((prev) =>
        prev.map((r) => (r.recipe.id === updatedRecipe.recipe.id ? updatedRecipe : r)),
      );
      if (!userId || isSampleRecipeId(updatedRecipe.recipe.id)) return;
      touch('recipes');
      void runRemote({ type: 'persistRecipe', recipe: updatedRecipe, touchedAt: nowIso() });
    },
    [userId, runRemote, touch],
  );

  const deleteRecipe = useCallback(
    (recipeId: string) => {
      setRecipes((prev) => prev.filter((r) => r.recipe.id !== recipeId));
      setMealPlan((prev) => ({
        ...prev,
        entries: prev.entries.filter((e) => e.recipeId !== recipeId),
      }));
      if (!userId || isSampleRecipeId(recipeId) || !isUuid(recipeId)) return;
      touch('recipes');
      void runRemote({ type: 'deleteRecipe', recipeId, touchedAt: nowIso() });
    },
    [userId, runRemote, touch],
  );

  const toggleRecipeStatus = useCallback(
    (recipeId: string) => {
      let patch: RecipeFlagPatch = {};
      setRecipes((prev) => {
        const next = prev.map((r) => {
          if (r.recipe.id !== recipeId) return r;
          const status: FullRecipe['recipe']['status'] =
            r.recipe.status === 'want_to_cook' ? 'cooked_liked' : 'want_to_cook';
          const lastCookedAt =
            status === 'cooked_liked' ? new Date().toISOString() : r.recipe.lastCookedAt;
          patch = { status, lastCookedAt: lastCookedAt ?? null };
          return {
            ...r,
            recipe: {
              ...r.recipe,
              status,
              lastCookedAt,
            },
          };
        });
        return next;
      });
      if (userId && isUuid(recipeId) && !isSampleRecipeId(recipeId)) {
        touch('recipes');
        void runRemote({ type: 'updateFlags', recipeId, patch, touchedAt: nowIso() });
      }
    },
    [userId, runRemote, touch],
  );

  const toggleVisibility = useCallback(
    (recipeId: string) => {
      let nextVisible = false;
      setRecipes((prev) => {
        const next = prev.map((r) => {
          if (r.recipe.id !== recipeId) return r;
          nextVisible = !r.recipe.visibleToFriends;
          return {
            ...r,
            recipe: {
              ...r.recipe,
              visibleToFriends: nextVisible,
            },
          };
        });
        return next;
      });
      if (userId && isUuid(recipeId) && !isSampleRecipeId(recipeId)) {
        touch('recipes');
        void runRemote({
          type: 'updateFlags',
          recipeId,
          patch: { visibleToFriends: nextVisible },
          touchedAt: nowIso(),
        });
      }
    },
    [userId, runRemote, touch],
  );

  const addToShoppingList = useCallback(
    (ingredientName: string, quantity: number, unit: string, recipeId?: string) => {
      setShoppingList((prev) => mergeByNameUnit(prev, ingredientName, quantity, unit, recipeId));
    },
    [],
  );

  const toggleShoppingItem = useCallback((itemId: string) => {
    setShoppingList((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    );
  }, []);

  const removeFromShoppingList = useCallback((itemId: string) => {
    setShoppingList((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const clearShoppingList = useCallback(() => {
    setShoppingList([]);
  }, []);

  const addShoppingItem = useCallback((name: string) => {
    setShoppingList((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ingredientName: name,
        checked: false,
      },
    ]);
  }, []);

  const addPantryItem = useCallback((name: string, quantity?: number, unit?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPantry((prev) => {
      const key = ingredientMergeKey(trimmed, unit || '');
      const existing = prev.find((item) => ingredientMergeKey(item.name, item.unit || '') === key);
      if (existing && quantity != null) {
        const merged = mergeQtyUnit(existing.quantity || 0, existing.unit || '', quantity, unit || '');
        return prev.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                name: pickDisplayName(item.name, trimmed),
                quantity: merged.quantity,
                unit: merged.unit || unit,
              }
            : item,
        );
      }
      if (existing) return prev;
      return [
        ...prev,
        { id: crypto.randomUUID(), name: trimmed, quantity, unit },
      ];
    });
  }, []);

  const removePantryItem = useCallback((itemId: string) => {
    setPantry((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const saveMealPlan = useCallback((plan: MealPlan) => {
    const dayCount = Math.min(7, Math.max(1, plan.dayCount));
    const seenIds = new Set<string>();
    const normalized: MealPlan = {
      dayCount,
      weekStart: plan.weekStart || mondayISO(),
      entries: plan.entries
        .filter((entry) => {
          if (seenIds.has(entry.id)) return false;
          seenIds.add(entry.id);
          return true;
        })
        .map((entry, idx) => ({
          ...entry,
          dayIndex: entry.dayIndex != null && entry.dayIndex < dayCount ? entry.dayIndex : null,
          mealSlot: entry.dayIndex == null ? null : entry.mealSlot ?? null,
          sortOrder: idx,
        })),
    };
    setMealPlan(normalized);
  }, []);

  const toggleInMenu = useCallback((recipeId: string) => {
    setMealPlan((prev) => {
      const exists = prev.entries.some((e) => e.recipeId === recipeId);
      if (exists) {
        return { ...prev, entries: prev.entries.filter((e) => e.recipeId !== recipeId) };
      }
      const recipe = recipesRef.current.find((r) => r.recipe.id === recipeId);
      return {
        ...prev,
        entries: [
          ...prev.entries,
          {
            id: crypto.randomUUID(),
            recipeId,
            dayIndex: null,
            sortOrder: prev.entries.length,
            servings: recipe?.recipe.servings || 1,
            mealSlot: null,
          } satisfies MealPlanEntry,
        ],
      };
    });
  }, []);

  const getTranslation = useCallback(
    (recipe: FullRecipe, language: Language): { title: string; description?: string } => {
      const translation = recipe.translations.find((t) => t.language === language);
      if (translation) {
        return {
          title: translation.title,
          description: translation.description,
        };
      }
      const fallback = recipe.translations.find((t) => t.language === 'ru');
      return fallback
        ? { title: fallback.title, description: fallback.description }
        : { title: 'Untitled' };
    },
    [],
  );

  const getIngredientName = useCallback(
    (ingredient: FullRecipe['ingredients'][0], language: Language): string => {
      const translation = ingredient.translations.find((t) => t.language === language);
      if (translation) {
        return translation.name;
      }
      const fallback = ingredient.translations.find((t) => t.language === 'ru');
      return fallback?.name || 'Unknown';
    },
    [],
  );

  const getStepInstruction = useCallback(
    (step: FullRecipe['steps'][0], language: Language): string => {
      const translation = step.translations.find((t) => t.language === language);
      if (translation) {
        return translation.instruction;
      }
      const fallback = step.translations.find((t) => t.language === 'ru');
      return fallback?.instruction || '';
    },
    [],
  );

  return {
    recipes,
    shoppingList,
    pantry,
    mealPlan,
    syncing,
    addRecipe,
    copyRecipe,
    updateRecipe,
    deleteRecipe,
    toggleRecipeStatus,
    toggleVisibility,
    addToShoppingList,
    toggleShoppingItem,
    removeFromShoppingList,
    clearShoppingList,
    addShoppingItem,
    addPantryItem,
    removePantryItem,
    saveMealPlan,
    toggleInMenu,
    getTranslation,
    getIngredientName,
    getStepInstruction,
  };
}

export function useVoiceSimulation() {
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');

  const startListening = useCallback(() => {
    setIsListening(true);
    setSpokenText('');
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setSpokenText('');
  }, []);

  const simulateVoiceCommand = useCallback(
    (_onNext?: () => void, _onPrevious?: () => void, _onQuery?: (query: string) => void) => {
      const phrases = ['Дальше', 'Next', 'Weiter', 'Сколько сахара?', 'How much sugar?'];
      let index = 0;

      const interval = setInterval(() => {
        if (isListening && index < phrases.length) {
          setSpokenText(phrases[index]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 3000);

      return () => clearInterval(interval);
    },
    [isListening],
  );

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, []);

  return {
    isListening,
    spokenText,
    startListening,
    stopListening,
    simulateVoiceCommand,
    speak,
  };
}
