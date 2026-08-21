import { useState, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { supabase } from '../lib/supabase';
import { Camera, Loader2, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

function compressScreenshot(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1000;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = objectUrl;
  });
}

interface FeedbackFormProps {
  userId: string;
  email?: string;
  online: boolean;
}

export function FeedbackForm({ userId, email, online }: FeedbackFormProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<'bug' | 'idea'>('bug');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setScreenshot(await compressScreenshot(file));
    } catch {
      setError(t('feedbackError'));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      setError(t('feedbackNeedText'));
      return;
    }
    if (!online) {
      setError(t('offlineHint'));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('feedback').insert({
        user_id: userId,
        email: email || null,
        kind,
        message: text,
        screenshot: screenshot || null,
        language,
      });
      if (insertError) throw insertError;
      setSent(true);
      setMessage('');
      setScreenshot(undefined);
    } catch {
      setError(t('feedbackError'));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="p-4 flex flex-col items-center text-center gap-2">
        <CheckCircle className={`w-8 h-8 ${theme.textAccent}`} />
        <p className={`text-sm font-medium ${theme.textPrimary}`}>{t('feedbackSent')}</p>
      </div>
    );
  }

  const inputCls = `w-full px-3 py-2.5 text-base ${theme.input}`;

  return (
    <div className="p-3 space-y-3">
      <p className={`text-sm ${theme.textSecondary}`}>{t('feedbackHint')}</p>

      <div className="flex gap-2">
        {(['bug', 'idea'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={`flex-1 py-2 text-sm font-medium ${kind === id ? theme.chipActive : theme.chip}`}
          >
            {id === 'bug' ? t('feedbackBug') : t('feedbackIdea')}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={2000}
        className={inputCls}
        placeholder={t('feedbackPlaceholder')}
      />

      {screenshot ? (
        <div className="relative">
          <img src={screenshot} alt="" className="w-full h-28 object-cover rounded-xl" />
          <button
            type="button"
            onClick={() => setScreenshot(undefined)}
            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow"
            title={t('feedbackRemovePhoto')}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      ) : (
        <label className={`flex items-center justify-center gap-2 w-full py-2.5 cursor-pointer ${theme.btnSoft} ${theme.textPrimary} text-sm font-medium`}>
          <Camera className="w-4 h-4" />
          {t('feedbackAttach')}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e)}
          />
        </label>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-500">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={sending || !online}
        className={`w-full py-2.5 ${theme.btnPrimary} font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
      >
        {sending && <Loader2 className="w-4 h-4 animate-spin" />}
        {t('feedbackSend')}
      </button>
    </div>
  );
}
