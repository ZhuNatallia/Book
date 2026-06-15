import { createContext, useContext, useState, ReactNode } from 'react';
import { translations, Language, TranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string) => string;
  tCategory: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ru');

  const t = (key: TranslationKey | string): string => {
    const keys = key.split('.');
    // @ts-expect-error - dynamic access
    let value: string | typeof translations.ru = translations[language];
    for (const k of keys) {
      // @ts-expect-error - dynamic access
      value = value?.[k];
    }
    return (value as string) || key;
  };

  const tCategory = (key: string): string => {
    // @ts-expect-error - dynamic access
    return translations[language].categories?.[key] || key;
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
