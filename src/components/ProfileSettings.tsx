import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { supabase } from '../lib/supabase';
import { Camera, Loader2 } from 'lucide-react';

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 400;
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
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = objectUrl;
  });
}

function nameInitial(label: string) {
  const letter = label.replace(/^@/, '').trim().charAt(0);
  return (letter || '?').toUpperCase();
}

export function AvatarBox({
  url,
  label,
  sizeClass = 'w-12 h-12 text-lg',
  gradient,
}: {
  url: string | null;
  label: string;
  sizeClass?: string;
  gradient: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${sizeClass} rounded-2xl object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shrink-0`}
    >
      {nameInitial(label)}
    </div>
  );
}

interface ProfileSettingsProps {
  userId: string;
  email?: string;
}

export function ProfileSettings({ userId, email }: ProfileSettingsProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [myName, setMyName] = useState('');
  const [myUsername, setMyUsername] = useState('');
  const [myPhone, setMyPhone] = useState('');
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, display_name, username, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (!profile) {
        await supabase.from('profiles').upsert({
          id: userId,
          email: email ?? null,
          display_name: email?.split('@')[0] ?? null,
        });
      }
      setMyPhone(profile?.phone ?? '');
      setMyName(profile?.display_name ?? email?.split('@')[0] ?? '');
      setMyUsername(profile?.username ?? '');
      setMyAvatar(profile?.avatar_url ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, email]);

  const handleAvatarFile = async (file?: File) => {
    if (!file) return;
    try {
      setMyAvatar(await compressAvatar(file));
    } catch (err) {
      console.error(err);
      setError(t('authErrorGeneric'));
    }
  };

  const handleSave = async () => {
    const username = normalizeUsername(myUsername);
    if (username && !USERNAME_RE.test(username)) {
      setError(t('invalidUsername'));
      setSaved(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase.from('profiles').upsert({
      id: userId,
      email: email ?? null,
      phone: myPhone.trim() || null,
      display_name: myName.trim() || null,
      username: username || null,
      avatar_url: myAvatar,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.code === '23505' ? t('usernameTaken') : t('authErrorGeneric'));
      return;
    }
    setMyUsername(username);
    setSaved(true);
  };

  const myLabel = myName.trim() || (myUsername ? `@${myUsername}` : email || '');
  const inputCls = `w-full px-3 py-2.5 text-base ${theme.input}`;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="relative shrink-0"
          title={t('changePhoto')}
        >
          <AvatarBox
            url={myAvatar}
            label={myLabel}
            sizeClass="w-14 h-14 text-lg"
            gradient={theme.headerLogoGradient}
          />
          <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white shadow border border-gray-100">
            <Camera className={`w-3 h-3 ${theme.textAccent}`} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className={`text-sm ${theme.textAccent}`}
        >
          {t('changePhoto')}
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleAvatarFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <input
        type="text"
        value={myName}
        onChange={(e) => setMyName(e.target.value)}
        placeholder={t('yourName')}
        className={inputCls}
      />
      <input
        type="text"
        value={myUsername ? (myUsername.startsWith('@') ? myUsername : `@${myUsername}`) : myUsername}
        onChange={(e) => setMyUsername(e.target.value)}
        placeholder={t('usernamePlaceholder')}
        className={inputCls}
      />
      <input
        type="tel"
        value={myPhone}
        onChange={(e) => setMyPhone(e.target.value)}
        placeholder={t('yourPhone')}
        className={inputCls}
      />
      {email && <p className={`text-xs ${theme.textSecondary} px-1`}>{email}</p>}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">{t('save')}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full px-4 py-2.5 ${theme.btnPrimary} text-base font-medium disabled:opacity-50`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('saveProfile')}
      </button>
    </div>
  );
}
