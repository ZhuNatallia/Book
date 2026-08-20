import { useEffect, useRef, useState } from 'react';
import { ListFilter, Refrigerator, Search } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { CategoryFilter } from './RecipeCard';
import { ShelfPicker } from './ShelfPicker';
import { RecipeSort } from '../types';

export type RecipeStatusFilter = 'all' | 'want_to_cook' | 'cooked_liked';

interface RecipeFilterBarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  statusFilter: RecipeStatusFilter;
  onSelectStatus: (status: RecipeStatusFilter) => void;
  showStatus?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onFridgeSearch?: () => void;
  extraTags?: string[];
  selectedTags?: string[];
  onSelectTags?: (tags: string[]) => void;
  sortBy?: RecipeSort;
  onSortChange?: (sort: RecipeSort) => void;
}

export function RecipeFilterBar({
  selectedCategory,
  onSelectCategory,
  statusFilter,
  onSelectStatus,
  showStatus = true,
  searchQuery = '',
  onSearchChange,
  onFridgeSearch,
  extraTags = [],
  selectedTags = [],
  onSelectTags,
  sortBy = 'newest',
  onSortChange,
}: RecipeFilterBarProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [draftStatus, setDraftStatus] = useState<RecipeStatusFilter>(statusFilter);
  const [draftSearch, setDraftSearch] = useState(searchQuery);
  const [draftTags, setDraftTags] = useState<string[]>(selectedTags);
  const [draftSort, setDraftSort] = useState<RecipeSort>(sortBy);
  const rootRef = useRef<HTMLDivElement>(null);

  const showSearch = !!onSearchChange;
  const filtersActive =
    selectedCategory !== 'all' ||
    statusFilter !== 'all' ||
    searchQuery.trim().length > 0 ||
    selectedTags.length > 0 ||
    sortBy !== 'newest';

  const openPanel = () => {
    setDraftCategory(selectedCategory);
    setDraftStatus(statusFilter);
    setDraftSearch(searchQuery);
    setDraftTags(selectedTags);
    setDraftSort(sortBy);
    setOpen(true);
  };

  const closePanel = () => setOpen(false);

  const applyFilters = () => {
    onSelectCategory(draftCategory);
    onSelectStatus(draftStatus);
    onSearchChange?.(draftSearch.trim());
    onSelectTags?.(draftTags);
    onSortChange?.(draftSort);
    setOpen(false);
  };

  const resetFilters = () => {
    onSelectCategory('all');
    onSelectStatus('all');
    onSearchChange?.('');
    onSelectTags?.([]);
    onSortChange?.('newest');
    setDraftCategory('all');
    setDraftStatus('all');
    setDraftSearch('');
    setDraftTags([]);
    setDraftSort('newest');
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closePanel();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const statuses: { id: RecipeStatusFilter; label: string }[] = [
    { id: 'all', label: t('all') },
    { id: 'cooked_liked', label: t('cookedLiked') },
    { id: 'want_to_cook', label: t('wantToCook') },
  ];

  return (
    <div ref={rootRef} className="px-4 mb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (open ? closePanel() : openPanel())}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-base font-medium ${
            open || filtersActive ? theme.chipActive : theme.chip
          }`}
        >
          <ListFilter className="w-5 h-5" />
          <span>{t('filter')}</span>
          {filtersActive && (
            <span className={`w-2 h-2 rounded-full ${theme.accentPrimary}`} />
          )}
        </button>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!filtersActive && !open}
          title={t('resetFilters')}
          className={`shrink-0 px-4 py-2.5 text-base font-medium ${theme.chip} disabled:opacity-40`}
        >
          {t('resetFilters')}
        </button>
      </div>

      {open && (
        <div className={`mt-3 p-3 ${theme.card} divide-y divide-[var(--stroke)]`}>
          <div className="pb-5">
            <p className={`px-1 pb-2 text-sm font-semibold ${theme.textPrimary}`}>
              {t('recipeCategories')}
            </p>
            <CategoryFilter
              selectedCategory={draftCategory}
              onSelectCategory={setDraftCategory}
              className="w-full"
            />
          </div>

          {showStatus && (
            <div className="py-5">
              <p className={`px-1 pb-2 text-sm font-semibold ${theme.textPrimary}`}>
                {t('filterStatus')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {statuses.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => setDraftStatus(status.id)}
                    className={`px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                      draftStatus === status.id ? theme.chipActive : theme.chip
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onSelectTags && (
            <div className="py-5">
              <p className={`px-1 pb-2 text-sm font-semibold ${theme.textPrimary}`}>
                {t('filterShelves')}
              </p>
              <ShelfPicker tags={draftTags} onChange={setDraftTags} extraTags={extraTags} />
            </div>
          )}

          {showSearch && (
            <div className="py-5">
              <p className={`px-1 pb-2 text-sm font-semibold ${theme.textPrimary}`}>
                {t('searchPlaceholder')}
              </p>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className={`w-full pl-12 pr-4 py-3 text-sm ${theme.input}`}
                />
              </div>
            </div>
          )}

          {onSortChange && (
            <div className="py-5">
              <p className={`px-1 pb-2 text-sm font-semibold ${theme.textPrimary}`}>
                {t('sortBy')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {([
                  ['newest', 'sortNewest'],
                  ['lastCooked', 'sortLastCooked'],
                  ['title', 'sortTitle'],
                ] as const).map(([id, key]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDraftSort(id)}
                    className={`px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                      draftSort === id ? theme.chipActive : theme.chip
                    }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onFridgeSearch && (
            <div className="pt-5">
              <button
                type="button"
                onClick={() => {
                  closePanel();
                  onFridgeSearch();
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${theme.chip}`}
              >
                <Refrigerator className="w-5 h-5" />
                {t('fridgeSearch')}
              </button>
            </div>
          )}

          <div className="pt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className={`py-3 text-sm font-semibold ${theme.btnSoft}`}
            >
              {t('resetFilters')}
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className={`py-3 text-sm font-semibold ${theme.btnPrimary}`}
            >
              {t('applyFilter')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
