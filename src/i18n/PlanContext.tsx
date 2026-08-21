import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isSampleRecipeId } from '../lib/recipeDb';
import {
  FREE_IMPORT_LIMIT,
  FREE_RECIPE_LIMIT,
  PlanPeriod,
  SubscriptionRow,
  isPlusActive,
} from '../lib/plan';
import { countImportsThisMonth, fetchSubscription, recordRecipeImport } from '../lib/planDb';
import { FullRecipe } from '../types';

export function ownRecipeCount(recipes: FullRecipe[]): number {
  return recipes.filter((r) => !isSampleRecipeId(r.recipe.id)).length;
}

type PlanContextValue = {
  loading: boolean;
  isPlus: boolean;
  expiredPlus: boolean;
  subscription: SubscriptionRow | null;
  recipeCount: number;
  recipeLimit: number | null;
  importsUsed: number;
  importLimit: number | null;
  canAddRecipe: boolean;
  canImport: boolean;
  periodPreview: PlanPeriod;
  setPeriodPreview: (period: PlanPeriod) => void;
  syncRecipeCount: (count: number) => void;
  refresh: () => Promise<void>;
  recordImport: (sourceUrl?: string) => Promise<void>;
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({
  userId,
  children,
}: {
  userId?: string;
  children: ReactNode;
}) {
  const [recipeCount, setRecipeCount] = useState(0);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [importsUsed, setImportsUsed] = useState(0);
  const [loading, setLoading] = useState(Boolean(userId));
  const [periodPreview, setPeriodPreview] = useState<PlanPeriod>('year');

  const refresh = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setImportsUsed(0);
      setLoading(false);
      return;
    }
    const [sub, used] = await Promise.all([
      fetchSubscription(userId),
      countImportsThisMonth(userId),
    ]);
    setSubscription(sub);
    setImportsUsed(used);
    if (sub?.period === 'month' || sub?.period === 'year') {
      setPeriodPreview(sub.period);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recordImport = useCallback(
    async (sourceUrl?: string) => {
      if (!userId) return;
      await recordRecipeImport(userId, sourceUrl);
      setImportsUsed((n) => n + 1);
    },
    [userId],
  );

  const isPlus = isPlusActive(subscription);
  const expiredPlus = subscription?.plan === 'plus' && !isPlus;
  const recipeLimit = isPlus ? null : FREE_RECIPE_LIMIT;
  const importLimit = isPlus ? null : FREE_IMPORT_LIMIT;

  return (
    <PlanContext.Provider
      value={{
        loading,
        isPlus,
        expiredPlus,
        subscription,
        recipeCount,
        recipeLimit,
        importsUsed,
        importLimit,
        canAddRecipe: isPlus || recipeCount < FREE_RECIPE_LIMIT,
        canImport: isPlus || importsUsed < FREE_IMPORT_LIMIT,
        periodPreview,
        setPeriodPreview,
        syncRecipeCount: setRecipeCount,
        refresh,
        recordImport,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}
