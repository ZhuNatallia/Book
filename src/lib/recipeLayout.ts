import { useCallback, useState } from 'react';

export type RecipeLayout = 'list' | 'grid';

const KEY = 'sr-recipe-layout';

export function loadRecipeLayout(): RecipeLayout {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'grid' || saved === 'list') return saved;
  } catch {
    /* private mode */
  }
  return 'list';
}

export function saveRecipeLayout(layout: RecipeLayout) {
  try {
    localStorage.setItem(KEY, layout);
  } catch {
    /* private mode */
  }
}

export function useRecipeLayout() {
  const [layout, setLayout] = useState<RecipeLayout>(loadRecipeLayout);
  const updateLayout = useCallback((next: RecipeLayout) => {
    setLayout(next);
    saveRecipeLayout(next);
  }, []);
  return [layout, updateLayout] as const;
}
