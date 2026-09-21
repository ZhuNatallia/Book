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
  setRecipeVisibility,
  RecipeFlagPatch,
  migrateDataUrlRecipeImages,
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
import { isQuotaError } from '../lib/plan';
import { ALL_CIRCLES, FriendCircle, circlesFromVisible, sameCircles } from '../lib/friendCircles';
import { isDataUrl, isHttpUrl } from '../lib/media';

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

function withLiveVisibility(full: FullRecipe, liveRecipes: FullRecipe[]): FullRecipe {
  const live = liveRecipes.find((r) => r.recipe.id === full.recipe.id);
  if (!live) return full;
  if (
    live.recipe.visibleToFriends === full.recipe.visibleToFriends &&
    sameCircles(live.recipe.visibleCircles, full.recipe.visibleCircles)
  ) {
    return full;
  }
  return {
    ...full,
    recipe: {
      ...full.recipe,
      visibleToFriends: live.recipe.visibleToFriends,
      visibleCircles: live.recipe.visibleCircles ?? circlesFromVisible(live.recipe.visibleToFriends),
    },
  };
}

function keepVisibility(incoming: FullRecipe, live?: FullRecipe): FullRecipe {
  if (!live) return incoming;
  if (
    live.recipe.visibleToFriends === incoming.recipe.visibleToFriends &&
    sameCircles(live.recipe.visibleCircles, incoming.recipe.visibleCircles)
  ) {
    return incoming;
  }
  return {
    ...incoming,
    recipe: {
      ...incoming.recipe,
      visibleToFriends: live.recipe.visibleToFriends,
      visibleCircles: live.recipe.visibleCircles ?? circlesFromVisible(live.recipe.visibleToFriends),
    },
  };
}

function applySavedEyes(
  recipes: FullRecipe[],
  eyes: Record<string, boolean>,
  circlesById: Record<string, FriendCircle[]> = {},
): FullRecipe[] {
  return recipes.map((full) => {
    const id = full.recipe.id;
    if (id in circlesById) {
      const circles = circlesById[id];
      const visible = circles.length > 0;
      if (full.recipe.visibleToFriends === visible && sameCircles(full.recipe.visibleCircles, circles)) {
        return full;
      }
      return {
        ...full,
        recipe: { ...full.recipe, visibleToFriends: visible, visibleCircles: circles },
      };
    }
    const visibleCircles =
      full.recipe.visibleCircles ?? circlesFromVisible(full.recipe.visibleToFriends ?? true);
    if (!(id in eyes) || full.recipe.visibleToFriends === eyes[id]) {
      if (sameCircles(full.recipe.visibleCircles, visibleCircles)) return full;
      return { ...full, recipe: { ...full.recipe, visibleCircles } };
    }
    const visible = eyes[id];
    return {
      ...full,
      recipe: {
        ...full.recipe,
        visibleToFriends: visible,
        visibleCircles: circlesFromVisible(visible, full.recipe.visibleCircles),
      },
    };
  });
}

function openedAllEyesKey(userId: string) {
  return `sr-opened-all-eyes-v1:${userId}`;
}

function hasOpenedAllEyes(userId: string): boolean {
  try {
    return localStorage.getItem(openedAllEyesKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markOpenedAllEyes(userId: string) {
  try {
    localStorage.setItem(openedAllEyesKey(userId), '1');
  } catch {
    /* ignore quota / private mode */
  }
}

function openHiddenOwnRecipes(
  list: FullRecipe[],
  eyes: Record<string, boolean>,
  circlesById: Record<string, FriendCircle[]>,
): { list: FullRecipe[]; openedIds: string[] } {
  const openedIds: string[] = [];
  const next = list.map((full) => {
    const id = full.recipe.id;
    if (isSampleRecipeId(id) || !isUuid(id) || full.recipe.visibleToFriends) {
      return full;
    }
    openedIds.push(id);
    eyes[id] = true;
    circlesById[id] = [...ALL_CIRCLES];
    return {
      ...full,
      recipe: { ...full.recipe, visibleToFriends: true, visibleCircles: [...ALL_CIRCLES] },
    };
  });
  return { list: openedIds.length ? next : list, openedIds };
}

function visibilityDiffs(
  remote: FullRecipe[],
  eyes: Record<string, boolean>,
  circlesById: Record<string, FriendCircle[]>,
): { recipeId: string; visible: boolean; circles: FriendCircle[] }[] {
  const diffs: { recipeId: string; visible: boolean; circles: FriendCircle[] }[] = [];
  for (const full of remote) {
    const id = full.recipe.id;
    if (!isUuid(id)) continue;
    if (id in circlesById) {
      const circles = circlesById[id];
      const visible = circles.length > 0;
      if (!sameCircles(circles, full.recipe.visibleCircles) || visible !== full.recipe.visibleToFriends) {
        diffs.push({ recipeId: id, visible, circles });
      }
      continue;
    }
    if (id in eyes && eyes[id] !== full.recipe.visibleToFriends) {
      diffs.push({
        recipeId: id,
        visible: eyes[id],
        circles: circlesFromVisible(eyes[id], full.recipe.visibleCircles),
      });
    }
  }
  return diffs;
}

function mergeOwnPhotos(
  remote: FullRecipe[],
  local: FullRecipe[],
): { merged: FullRecipe[]; toUpload: FullRecipe[] } {
  const localById = new Map(local.map((r) => [r.recipe.id, r]));
  const toUpload: FullRecipe[] = [];
  const merged = remote.map((r) => {
    const remoteUrl = r.recipe.imageUrl;
    if (isHttpUrl(remoteUrl) && !isDataUrl(remoteUrl)) return r;
    const localUrl = localById.get(r.recipe.id)?.recipe.imageUrl;
    if (localUrl && (isDataUrl(localUrl) || isHttpUrl(localUrl))) {
      const next = { ...r, recipe: { ...r.recipe, imageUrl: localUrl } };
      if (isUuid(r.recipe.id) && !isSampleRecipeId(r.recipe.id)) toUpload.push(next);
      return next;
    }
    return r;
  });
  return { merged, toUpload };
}

function applyPendingJobs(recipes: FullRecipe[], jobs: SyncJob[]): FullRecipe[] {
  let next = recipes;
  for (const job of jobs) {
    if (job.type === 'persistRecipe') {
      const id = job.recipe.recipe.id;
      const existing = next.find((r) => r.recipe.id === id);
      const incoming = keepVisibility(job.recipe, existing);
      if (existing) {
        next = next.map((r) => (r.recipe.id === id ? incoming : r));
      } else {
        next = [...next, incoming];
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
            ...(job.patch.visibleCircles !== undefined
              ? { visibleCircles: job.patch.visibleCircles as FriendCircle[] }
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
    if (!cache) return sampleRecipes;
    const eyes = { ...(cache.visibilityById ?? {}) };
    const circles = { ...(cache.visibilityCirclesById ?? {}) } as Record<string, FriendCircle[]>;
    let own = applySavedEyes(cache.recipes, eyes, circles);
    if (!hasOpenedAllEyes(userId)) {
      own = openHiddenOwnRecipes(own, eyes, circles).list;
    }
    return [...sampleRecipes, ...own];
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
  const visibilityRef = useRef<Record<string, boolean>>(
    userId ? loadBookCache(userId)?.visibilityById ?? {} : {},
  );
  const circlesRef = useRef<Record<string, FriendCircle[]>>(
    (userId ? loadBookCache(userId)?.visibilityCirclesById ?? {} : {}) as Record<string, FriendCircle[]>,
  );
  recipesRef.current = recipes;
  shoppingRef.current = shoppingList;
  pantryRef.current = pantry;
  mealPlanRef.current = mealPlan;

  const persistCache = useCallback(() => {
    if (!userId) return;
    const own = recipesRef.current.filter((r) => !isSampleRecipeId(r.recipe.id));
    const cache: BookCache = {
      recipes: applySavedEyes(own, visibilityRef.current, circlesRef.current),
      shoppingList: shoppingRef.current,
      pantry: pantryRef.current,
      mealPlan: mealPlanRef.current,
      queue: queueRef.current,
      localTouchedAt: touchedRef.current,
      visibilityById: visibilityRef.current,
      visibilityCirclesById: circlesRef.current,
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
          const saved = await persistFullRecipe(
            userId,
            withLiveVisibility(
              job.recipe,
              applySavedEyes(recipesRef.current, visibilityRef.current, circlesRef.current),
            ),
          );
          const liveCircles = circlesRef.current[saved.recipe.id];
          const liveVisible = liveCircles
            ? liveCircles.length > 0
            : (visibilityRef.current[saved.recipe.id] ?? saved.recipe.visibleToFriends);
          if (
            (liveCircles && !sameCircles(liveCircles, saved.recipe.visibleCircles)) ||
            liveVisible !== saved.recipe.visibleToFriends
          ) {
            await setRecipeVisibility(saved.recipe.id, liveVisible, liveCircles);
          }
        } else if (job.type === 'updateFlags') {
          await updateRecipeFlags(job.recipeId, job.patch);
        } else if (job.type === 'deleteRecipe') {
          await deleteRemoteRecipe(job.recipeId, userId);
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
      } catch (err) {
        if (!isQuotaError(err)) remaining.push(job);
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
          const saved = await persistFullRecipe(
            userId,
            withLiveVisibility(
              job.recipe,
              applySavedEyes(recipesRef.current, visibilityRef.current, circlesRef.current),
            ),
          );
          const liveCircles = circlesRef.current[saved.recipe.id];
          const liveVisible = liveCircles
            ? liveCircles.length > 0
            : (visibilityRef.current[saved.recipe.id] ?? saved.recipe.visibleToFriends);
          if (
            (liveCircles && !sameCircles(liveCircles, saved.recipe.visibleCircles)) ||
            liveVisible !== saved.recipe.visibleToFriends
          ) {
            await setRecipeVisibility(saved.recipe.id, liveVisible, liveCircles);
          }
          setRecipes((prev) =>
            applySavedEyes(
              prev.map((r) => {
                if (r.recipe.id !== job.recipe.recipe.id && r.recipe.id !== saved.recipe.id) {
                  return r;
                }
                return saved;
              }),
              visibilityRef.current,
              circlesRef.current,
            ),
          );
        } else if (job.type === 'updateFlags') {
          await updateRecipeFlags(job.recipeId, job.patch);
        } else if (job.type === 'deleteRecipe') {
          await deleteRemoteRecipe(job.recipeId, userId);
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
      } catch (err) {
        if (!isQuotaError(err)) enqueue(job);
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
      visibilityRef.current = {};
      circlesRef.current = {};
      return;
    }
    const cached = loadBookCache(userId) ?? emptyBookCache();
    queueRef.current = cached.queue;
    touchedRef.current = cached.localTouchedAt;
    visibilityRef.current = { ...(cached.visibilityById ?? {}) };
    circlesRef.current = { ...((cached.visibilityCirclesById ?? {}) as Record<string, FriendCircle[]>) };
    let cachedOwn = applySavedEyes(cached.recipes, visibilityRef.current, circlesRef.current);
    if (!hasOpenedAllEyes(userId)) {
      const opened = openHiddenOwnRecipes(cachedOwn, visibilityRef.current, circlesRef.current);
      cachedOwn = opened.list;
      if (opened.openedIds.length > 0) {
        const touchedAt = nowIso();
        touchedRef.current = { ...touchedRef.current, recipes: touchedAt };
        for (const recipeId of opened.openedIds) {
          enqueue({
            type: 'updateFlags',
            recipeId,
            patch: { visibleToFriends: true, visibleCircles: [...ALL_CIRCLES] },
            touchedAt,
          });
        }
      }
    }
    setRecipes([...sampleRecipes, ...cachedOwn]);
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
          let remote = applySavedEyes(remoteRes.value, visibilityRef.current, circlesRef.current);
          if (!hasOpenedAllEyes(userId)) {
            const opened = openHiddenOwnRecipes(remote, visibilityRef.current, circlesRef.current);
            remote = opened.list;
            if (opened.openedIds.length > 0) {
              const touchedAt = nowIso();
              touchedRef.current = { ...touchedRef.current, recipes: touchedAt };
              for (const recipeId of opened.openedIds) {
                enqueue({
                  type: 'updateFlags',
                  recipeId,
                  patch: { visibleToFriends: true, visibleCircles: [...ALL_CIRCLES] },
                  touchedAt,
                });
              }
            }
            markOpenedAllEyes(userId);
          }
          if (hasRecipeJobs(jobs) || hasRecipeJobs(queueRef.current)) {
            remote = applyPendingJobs(remote, queueRef.current);
          }
          const photoMerge = mergeOwnPhotos(remote, cachedOwn);
          remote = photoMerge.merged;
          setRecipes([...sampleRecipes, ...remote]);
          const diffs = visibilityDiffs(remoteRes.value, visibilityRef.current, circlesRef.current);
          for (const diff of diffs) {
            void setRecipeVisibility(diff.recipeId, diff.visible, diff.circles).catch((err) => {
              if (!isQuotaError(err)) {
                enqueue({
                  type: 'updateFlags',
                  recipeId: diff.recipeId,
                  patch: { visibleToFriends: diff.visible, visibleCircles: diff.circles },
                  touchedAt: nowIso(),
                });
              }
            });
          }
          if (photoMerge.toUpload.length > 0) {
            const touchedAt = nowIso();
            for (const full of photoMerge.toUpload) {
              enqueue({ type: 'persistRecipe', recipe: full, touchedAt });
            }
            void flushQueue();
          }
          if (navigator.onLine && remote.some((r) => r.recipe.imageUrl?.startsWith('data:'))) {
            remote = await migrateDataUrlRecipeImages(userId, remote);
            if (cancelled) return;
            remote = applySavedEyes(remote, visibilityRef.current, circlesRef.current);
            if (hasRecipeJobs(queueRef.current)) {
              remote = applyPendingJobs(remote, queueRef.current);
            }
            setRecipes([...sampleRecipes, ...remote]);
          }
        } else if (!hasOpenedAllEyes(userId) && cached.recipes.length > 0) {
          markOpenedAllEyes(userId);
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
  }, [userId, flushQueue, persistCache, enqueue]);

  const addRecipe = useCallback(
    (recipe: FullRecipe) => {
      if (!isSampleRecipeId(recipe.recipe.id)) {
        const circles = circlesFromVisible(
          recipe.recipe.visibleToFriends ?? true,
          recipe.recipe.visibleCircles,
        );
        visibilityRef.current = {
          ...visibilityRef.current,
          [recipe.recipe.id]: circles.length > 0,
        };
        circlesRef.current = { ...circlesRef.current, [recipe.recipe.id]: circles };
      }
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
      const id = updatedRecipe.recipe.id;
      const circles =
        circlesRef.current[id] ??
        circlesFromVisible(
          visibilityRef.current[id] ?? updatedRecipe.recipe.visibleToFriends ?? true,
          updatedRecipe.recipe.visibleCircles,
        );
      const visible = circles.length > 0;
      visibilityRef.current = { ...visibilityRef.current, [id]: visible };
      circlesRef.current = { ...circlesRef.current, [id]: circles };
      const toSave = {
        ...updatedRecipe,
        recipe: { ...updatedRecipe.recipe, visibleToFriends: visible, visibleCircles: circles },
      };
      setRecipes((prev) => prev.map((r) => (r.recipe.id === id ? toSave : r)));
      if (!userId || isSampleRecipeId(id)) return;
      touch('recipes');
      void runRemote({ type: 'persistRecipe', recipe: toSave, touchedAt: nowIso() });
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
      if (recipeId in visibilityRef.current) {
        const nextEyes = { ...visibilityRef.current };
        delete nextEyes[recipeId];
        visibilityRef.current = nextEyes;
      }
      if (recipeId in circlesRef.current) {
        const nextCircles = { ...circlesRef.current };
        delete nextCircles[recipeId];
        circlesRef.current = nextCircles;
      }
      if (!userId || isSampleRecipeId(recipeId) || !isUuid(recipeId)) return;
      touch('recipes');
      void runRemote({ type: 'deleteRecipe', recipeId, touchedAt: nowIso() });
    },
    [userId, runRemote, touch],
  );

  const removeCopiedFromFriend = useCallback(
    (friendId: string) => {
      const ids = recipesRef.current
        .filter((r) => r.recipe.copiedFromUserId === friendId)
        .map((r) => r.recipe.id);
      ids.forEach(deleteRecipe);
    },
    [deleteRecipe],
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

  const setRecipeCircles = useCallback(
    (recipeId: string, nextCircles: FriendCircle[]) => {
      const current = recipesRef.current.find((r) => r.recipe.id === recipeId);
      if (!current || isSampleRecipeId(recipeId)) return;
      const circles = circlesFromVisible(nextCircles.length > 0, nextCircles);
      const nextVisible = circles.length > 0;
      visibilityRef.current = { ...visibilityRef.current, [recipeId]: nextVisible };
      circlesRef.current = { ...circlesRef.current, [recipeId]: circles };
      setRecipes((prev) =>
        prev.map((r) =>
          r.recipe.id === recipeId
            ? { ...r, recipe: { ...r.recipe, visibleToFriends: nextVisible, visibleCircles: circles } }
            : r,
        ),
      );
      if (userId && isUuid(recipeId)) {
        touch('recipes');
        queueRef.current = queueRef.current.map((job) => {
          if (job.type !== 'persistRecipe' || job.recipe.recipe.id !== recipeId) return job;
          return {
            ...job,
            recipe: {
              ...job.recipe,
              recipe: {
                ...job.recipe.recipe,
                visibleToFriends: nextVisible,
                visibleCircles: circles,
              },
            },
          };
        });
        persistCache();
        void runRemote({
          type: 'updateFlags',
          recipeId,
          patch: { visibleToFriends: nextVisible, visibleCircles: circles },
          touchedAt: nowIso(),
        });
      }
    },
    [userId, runRemote, touch, persistCache],
  );

  const toggleVisibility = useCallback(
    (recipeId: string) => {
      const current = recipesRef.current.find((r) => r.recipe.id === recipeId);
      if (!current || isSampleRecipeId(recipeId)) return;
      const nextVisible = !current.recipe.visibleToFriends;
      setRecipeCircles(recipeId, nextVisible ? ALL_CIRCLES : []);
    },
    [setRecipeCircles],
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
    removeCopiedFromFriend,
    toggleRecipeStatus,
    toggleVisibility,
    setRecipeCircles,
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
