import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { usePlan } from '../i18n/PlanContext';
import { Check, Sparkles } from 'lucide-react';

function UsageBar({
  label,
  used,
  limit,
  unlimitedLabel,
}: {
  label: string;
  used: number;
  limit: number | null;
  unlimitedLabel: string;
}) {
  const { theme } = useTheme();
  const pct = limit == null ? 8 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-sm ${theme.textSecondary}`}>{label}</span>
        <span className={`text-sm font-medium ${theme.textPrimary}`}>
          {limit == null ? `${used} · ${unlimitedLabel}` : `${used} / ${limit}`}
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${theme.bgSecondary}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${theme.headerLogoGradient}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PlanSettings() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const {
    isPlus,
    expiredPlus,
    subscription,
    recipeCount,
    recipeLimit,
    importsUsed,
    importLimit,
    periodPreview,
    setPeriodPreview,
  } = usePlan();

  const until = subscription?.valid_until
    ? new Date(subscription.valid_until).toLocaleDateString(language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const freeFeatures = [t('planRecipesFree'), t('planImportsFree'), t('planNoAds')];
  const plusFeatures = [t('planRecipesPlus'), t('planImportsPlus'), t('planNoAds')];

  return (
    <div className="p-3 space-y-4">
      <div>
        <p className={`text-xs font-medium uppercase tracking-wide ${theme.textSecondary}`}>
          {t('planYourPlan')}
        </p>
        <p className={`text-lg font-semibold ${theme.textPrimary}`}>
          {isPlus ? t('planPlus') : t('planFree')}
          {isPlus && until ? ` · ${t('planActiveUntil')} ${until}` : ''}
        </p>
        {expiredPlus && (
          <p className={`text-sm mt-1 ${theme.textSecondary}`}>{t('planExpired')}</p>
        )}
      </div>

      <div className="space-y-3">
        <UsageBar
          label={t('planUsageRecipes')}
          used={recipeCount}
          limit={recipeLimit}
          unlimitedLabel={t('planUnlimited')}
        />
        <UsageBar
          label={t('planUsageImports')}
          used={importsUsed}
          limit={importLimit}
          unlimitedLabel={t('planUnlimited')}
        />
      </div>

      <div className={`rounded-2xl border ${theme.border} p-3 ${!isPlus ? theme.tabActiveBg : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`font-semibold ${theme.textPrimary}`}>{t('planFree')}</p>
          {!isPlus && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme.chip}`}>
              {t('planCurrent')}
            </span>
          )}
        </div>
        <p className={`text-sm mb-2 ${theme.textSecondary}`}>{t('planFreeDesc')}</p>
        <ul className="space-y-1">
          {freeFeatures.map((line) => (
            <li key={line} className={`flex items-start gap-2 text-sm ${theme.textPrimary}`}>
              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${theme.textAccent}`} />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className={`rounded-2xl border ${theme.border} p-3 ${isPlus ? theme.tabActiveBg : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`font-semibold ${theme.textPrimary} flex items-center gap-1.5`}>
            <Sparkles className={`w-4 h-4 ${theme.textAccent}`} />
            {t('planPlus')}
          </p>
          {isPlus && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme.chip}`}>
              {t('planCurrent')}
            </span>
          )}
        </div>
        <p className={`text-sm mb-3 ${theme.textSecondary}`}>{t('planPlusDesc')}</p>

        <div className="neu-segment grid grid-cols-2 gap-1 p-1 mb-3">
          <button
            type="button"
            onClick={() => setPeriodPreview('month')}
            className={`py-2 text-sm font-medium rounded-xl ${
              periodPreview === 'month' ? `${theme.tabActiveBg} ${theme.tabActive}` : theme.textSecondary
            }`}
          >
            {t('planMonth')}
          </button>
          <button
            type="button"
            onClick={() => setPeriodPreview('year')}
            className={`py-2 text-sm font-medium rounded-xl ${
              periodPreview === 'year' ? `${theme.tabActiveBg} ${theme.tabActive}` : theme.textSecondary
            }`}
          >
            {t('planYear')}
          </button>
        </div>
        {periodPreview === 'year' && (
          <p className={`text-xs mb-3 ${theme.textSecondary}`}>{t('planYearHint')}</p>
        )}

        <ul className="space-y-1 mb-3">
          {plusFeatures.map((line) => (
            <li key={line} className={`flex items-start gap-2 text-sm ${theme.textPrimary}`}>
              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${theme.textAccent}`} />
              {line}
            </li>
          ))}
        </ul>

        {!isPlus && (
          <>
            <button
              type="button"
              disabled
              className={`w-full py-2.5 ${theme.btnPrimary} font-medium opacity-50 cursor-not-allowed`}
            >
              {t('planCheckoutSoon')}
            </button>
            <p className={`text-xs mt-2 ${theme.textSecondary}`}>{t('planPaySoon')}</p>
          </>
        )}
      </div>
    </div>
  );
}
