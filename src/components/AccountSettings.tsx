import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { supabase } from '../lib/supabase';
import { downloadBookJson, ownRecipes, printBookPdf } from '../lib/exportBook';
import { FullRecipe } from '../types';
import { Download, FileText, Loader2, AlertCircle, Trash2 } from 'lucide-react';

interface AccountSettingsProps {
  userId: string;
  email?: string;
  online: boolean;
  recipes: FullRecipe[];
  onDeleted: () => void;
}

export function AccountSettings({
  userId,
  email,
  online,
  recipes,
  onDeleted,
}: AccountSettingsProps) {
  const { t, tCategory, language } = useLanguage();
  const { theme } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = ownRecipes(recipes);
  const labels = {
    appName: t('appName'),
    ingredients: t('ingredients'),
    steps: t('steps'),
    servings: t('servings'),
    notes: t('myNotes'),
    source: t('source'),
  };

  const handlePdf = () => {
    if (mine.length === 0) {
      setError(t('accountExportEmpty'));
      return;
    }
    setError(null);
    const opened = printBookPdf(mine, language, labels, tCategory);
    if (!opened) setError(t('accountDeleteError'));
  };

  const handleJson = () => {
    if (mine.length === 0) {
      setError(t('accountExportEmpty'));
      return;
    }
    setError(null);
    downloadBookJson(mine, language, email, tCategory);
  };

  const handleDelete = async () => {
    if (!understood || !online) return;
    setDeleting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('delete-account');
      if (fnError || data?.error) throw new Error(fnError?.message ?? data?.error);
      try {
        localStorage.removeItem(`sr-book-${userId}`);
      } catch {
        /* ignore */
      }
      onDeleted();
    } catch {
      setError(t('accountDeleteError'));
      setDeleting(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <p className={`text-sm ${theme.textSecondary}`}>{t('accountExportHint')}</p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={handlePdf}
          className={`w-full py-2.5 ${theme.btnPrimary} font-medium flex items-center justify-center gap-2`}
        >
          <Download className="w-4 h-4" />
          {t('accountExportPdf')}
        </button>
        <button
          type="button"
          onClick={handleJson}
          className={`w-full py-2.5 ${theme.btnSoft} ${theme.textPrimary} font-medium flex items-center justify-center gap-2`}
        >
          <FileText className="w-4 h-4" />
          {t('accountExportJson')}
        </button>
      </div>

      <div className={`pt-3 border-t ${theme.border} space-y-2`}>
        {!confirming ? (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
              setUnderstood(false);
              setError(null);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-rose-500 font-medium hover:bg-rose-50"
          >
            <Trash2 className="w-4 h-4" />
            {t('accountDelete')}
          </button>
        ) : (
          <>
            <p className={`text-sm ${theme.textPrimary}`}>{t('accountDeleteWarn')}</p>
            <label className={`flex items-start gap-2 text-sm ${theme.textPrimary}`}>
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5"
              />
              {t('accountDeleteCheck')}
            </label>
            {!online && (
              <p className={`text-sm ${theme.textSecondary}`}>{t('offlineHint')}</p>
            )}
            <button
              type="button"
              disabled={!understood || !online || deleting}
              onClick={() => void handleDelete()}
              className="w-full py-2.5 rounded-xl bg-rose-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('accountDeleteConfirm')}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirming(false)}
              className={`w-full py-2 ${theme.textSecondary} text-sm`}
            >
              {t('accountDeleteCancel')}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-500">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}
