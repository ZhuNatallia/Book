import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKey } from './translations';

const STORAGE_KEY = 'app-language';

const LANG_ALIASES: Record<string, Language> = {
  ua: 'uk',
  ukr: 'uk',
  kz: 'kk',
  kaz: 'kk',
};

function matchLanguage(tag: string): Language | null {
  const base = tag.toLowerCase().replace('_', '-').split('-')[0];
  if (base in translations) return base as Language;
  return LANG_ALIASES[base] ?? null;
}

function detectDeviceLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const tags = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const tag of tags) {
    const hit = matchLanguage(tag);
    if (hit) return hit;
  }
  return 'en';
}

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in translations) return saved as Language;
  } catch {
    /* private mode */
  }
  return detectDeviceLanguage();
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string) => string;
  tCategory: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.title = translations[language].appName;
  }, [language]);

  const t = (key: TranslationKey | string): string => {
    const keys = key.split('.');
    const read = (lang: Language) => {
      let value: unknown = translations[lang];
      for (const k of keys) {
        if (value && typeof value === 'object') {
          // @ts-expect-error - dynamic access
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }
      return typeof value === 'string' ? value : undefined;
    };
    return read(language) || (language !== 'ru' ? read('ru') : undefined) || key;
  };

  const tCategory = (key: string): string => {
    // @ts-expect-error - dynamic access
    return translations[language].categories?.[key]
      // @ts-expect-error - dynamic access
      || (language !== 'ru' ? translations.ru.categories?.[key] : undefined)
      || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tCategory }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
