import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { usePlan } from '../i18n/PlanContext';
import { snoozeTrialOffer } from '../lib/trialOffer';
import { Sparkles } from 'lucide-react';

export function TrialOffer({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { startTrial } = usePlan();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const later = () => {
    snoozeTrialOffer(userId);
    setHidden(true);
  };

  const tryPlus = async () => {
    if (busy) return;
    setBusy(true);
    const result = await startTrial();
    setBusy(false);
    snoozeTrialOffer(userId);
    if (result.ok || result.status === 'already') setHidden(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/25">
      <div className={`${theme.card} w-full max-w-sm p-5`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={`w-5 h-5 ${theme.textAccent}`} />
          <p className={`text-lg font-semibold ${theme.textPrimary}`}>{t('planTrialTitle')}</p>
        </div>
        <p className={`text-sm mb-5 ${theme.textSecondary}`}>{t('planTrialDesc')}</p>
        <button
          type="button"
          onClick={() => void tryPlus()}
          disabled={busy}
          className={`w-full py-3 mb-2 ${theme.btnPrimary} font-semibold disabled:opacity-50`}
        >
          {t('planTrialStart')}
        </button>
        <button
          type="button"
          onClick={later}
          className={`w-full py-3 ${theme.btnSoft} font-semibold ${theme.textPrimary}`}
        >
          {t('planTrialLater')}
        </button>
      </div>
    </div>
  );
}
