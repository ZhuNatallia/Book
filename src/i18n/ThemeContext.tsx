import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type ThemeId = 'light' | 'dark' | 'turquoise' | 'pumpkin' | 'lavender';

export interface Theme {
  id: ThemeId;
  name: { ru: string; en: string; de: string };
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  accentPrimary: string;
  accentSecondary: string;
  accentGradient: string;
  accentHover: string;
  textPrimary: string;
  textSecondary: string;
  textAccent: string;
  border: string;
  borderAccent: string;
  headerBg: string;
  headerBorder: string;
  headerLogoGradient: string;
  headerTitleGradient: string;
  headerLangActive: string;
  headerLangInactive: string;
  headerLangBg: string;
  headerAddBtn: string;
  headerAddBtnHover: string;
  headerText: string;
  bottomNavBg: string;
  bottomNavBorder: string;
  bottomNavActive: string;
  bottomNavActiveBg: string;
  bottomNavInactive: string;
  catFilterActive: string;
  catFilterInactive: string;
  tabActive: string;
  tabActiveBorder: string;
  tabActiveBg: string;
  inputBg: string;
  inputText: string;
  inputBorder: string;
  inputPlaceholder: string;
  modalBg: string;
  modalBorder: string;
  modalHeaderBg: string;
  label: string;
}

export const themes: Record<ThemeId, Theme> = {
  light: {
    id: 'light',
    name: { ru: 'Светлая', en: 'Light', de: 'Hell' },
    bgPrimary: 'bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50',
    bgSecondary: 'bg-white',
    bgCard: 'bg-white',
    accentPrimary: 'bg-orange-500',
    accentSecondary: 'bg-rose-500',
    accentGradient: 'bg-gradient-to-r from-orange-500 to-rose-500',
    accentHover: 'hover:from-orange-600 hover:to-rose-600',
    textPrimary: 'text-gray-800',
    textSecondary: 'text-gray-500',
    textAccent: 'text-orange-600',
    border: 'border-amber-100',
    borderAccent: 'border-orange-300',
    headerBg: 'bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50',
    headerBorder: 'border-amber-200/50',
    headerLogoGradient: 'from-orange-500 to-rose-500',
    headerTitleGradient: 'from-orange-600 to-rose-600',
    headerLangActive: 'from-orange-500 to-rose-500',
    headerLangInactive: 'text-gray-600 hover:bg-amber-100/50',
    headerLangBg: 'bg-white/60 border-amber-100',
    headerAddBtn: 'from-orange-500 to-rose-500',
    headerAddBtnHover: 'hover:from-orange-600 hover:to-rose-600',
    headerText: 'text-white',
    bottomNavBg: 'bg-white/95',
    bottomNavBorder: 'border-amber-100',
    bottomNavActive: 'text-orange-600',
    bottomNavActiveBg: 'bg-orange-50',
    bottomNavInactive: 'text-gray-500 hover:text-orange-500',
    catFilterActive: 'from-orange-500 to-rose-500',
    catFilterInactive: 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600',
    tabActive: 'text-orange-600',
    tabActiveBorder: 'border-orange-500',
    tabActiveBg: 'bg-orange-50',
    inputBg: 'bg-white',
    inputText: 'text-gray-800',
    inputBorder: 'border-gray-200',
    inputPlaceholder: 'placeholder-gray-400',
    modalBg: 'bg-white',
    modalBorder: 'border-gray-100',
    modalHeaderBg: 'bg-gradient-to-r from-amber-50 to-rose-50',
    label: 'text-gray-700',
  },
  dark: {
    id: 'dark',
    name: { ru: 'Темная', en: 'Dark', de: 'Dunkel' },
    bgPrimary: 'bg-zinc-900',
    bgSecondary: 'bg-zinc-800',
    bgCard: 'bg-zinc-800',
    accentPrimary: 'bg-amber-500',
    accentSecondary: 'bg-orange-500',
    accentGradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
    accentHover: 'hover:from-amber-600 hover:to-orange-600',
    textPrimary: 'text-zinc-100',
    textSecondary: 'text-zinc-400',
    textAccent: 'text-amber-400',
    border: 'border-zinc-700',
    borderAccent: 'border-amber-600',
    headerBg: 'bg-zinc-900',
    headerBorder: 'border-zinc-700',
    headerLogoGradient: 'from-amber-500 to-orange-500',
    headerTitleGradient: 'from-amber-400 to-orange-400',
    headerLangActive: 'from-amber-500 to-orange-500',
    headerLangInactive: 'text-zinc-400 hover:bg-zinc-700',
    headerLangBg: 'bg-zinc-800 border-zinc-700',
    headerAddBtn: 'from-amber-500 to-orange-500',
    headerAddBtnHover: 'hover:from-amber-600 hover:to-orange-600',
    headerText: 'text-white',
    bottomNavBg: 'bg-zinc-900/95',
    bottomNavBorder: 'border-zinc-700',
    bottomNavActive: 'text-amber-400',
    bottomNavActiveBg: 'bg-zinc-800',
    bottomNavInactive: 'text-zinc-500 hover:text-amber-500',
    catFilterActive: 'from-amber-500 to-orange-500',
    catFilterInactive: 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-amber-500 hover:text-amber-400',
    tabActive: 'text-amber-400',
    tabActiveBorder: 'border-amber-500',
    tabActiveBg: 'bg-zinc-700/50',
    inputBg: 'bg-zinc-700',
    inputText: 'text-zinc-100',
    inputBorder: 'border-zinc-600',
    inputPlaceholder: 'placeholder-zinc-500',
    modalBg: 'bg-zinc-800',
    modalBorder: 'border-zinc-700',
    modalHeaderBg: 'bg-zinc-900',
    label: 'text-zinc-300',
  },
  turquoise: {
    id: 'turquoise',
    name: { ru: 'Нежная бирюза', en: 'Soft Turquoise', de: 'Sanftes Türkis' },
    bgPrimary: 'bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50',
    bgSecondary: 'bg-white',
    bgCard: 'bg-white',
    accentPrimary: 'bg-teal-500',
    accentSecondary: 'bg-cyan-500',
    accentGradient: 'bg-gradient-to-r from-teal-500 to-cyan-500',
    accentHover: 'hover:from-teal-600 hover:to-cyan-600',
    textPrimary: 'text-gray-800',
    textSecondary: 'text-gray-500',
    textAccent: 'text-teal-600',
    border: 'border-teal-100',
    borderAccent: 'border-teal-300',
    headerBg: 'bg-gradient-to-r from-teal-50 via-cyan-50 to-emerald-50',
    headerBorder: 'border-teal-200/50',
    headerLogoGradient: 'from-teal-500 to-cyan-500',
    headerTitleGradient: 'from-teal-600 to-cyan-600',
    headerLangActive: 'from-teal-500 to-cyan-500',
    headerLangInactive: 'text-gray-600 hover:bg-teal-100/50',
    headerLangBg: 'bg-white/60 border-teal-100',
    headerAddBtn: 'from-teal-500 to-cyan-500',
    headerAddBtnHover: 'hover:from-teal-600 hover:to-cyan-600',
    headerText: 'text-white',
    bottomNavBg: 'bg-white/95',
    bottomNavBorder: 'border-teal-100',
    bottomNavActive: 'text-teal-600',
    bottomNavActiveBg: 'bg-teal-50',
    bottomNavInactive: 'text-gray-500 hover:text-teal-500',
    catFilterActive: 'from-teal-500 to-cyan-500',
    catFilterInactive: 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-600',
    tabActive: 'text-teal-600',
    tabActiveBorder: 'border-teal-500',
    tabActiveBg: 'bg-teal-50',
    inputBg: 'bg-white',
    inputText: 'text-gray-800',
    inputBorder: 'border-gray-200',
    inputPlaceholder: 'placeholder-gray-400',
    modalBg: 'bg-white',
    modalBorder: 'border-teal-100',
    modalHeaderBg: 'bg-gradient-to-r from-teal-50 to-cyan-50',
    label: 'text-gray-700',
  },
  pumpkin: {
    id: 'pumpkin',
    name: { ru: 'Теплая тыква', en: 'Warm Pumpkin', de: 'Warmes Kürbis' },
    bgPrimary: 'bg-orange-50',
    bgSecondary: 'bg-white',
    bgCard: 'bg-white',
    accentPrimary: 'bg-orange-500',
    accentSecondary: 'bg-amber-500',
    accentGradient: 'bg-gradient-to-r from-orange-500 to-amber-500',
    accentHover: 'hover:from-orange-600 hover:to-amber-600',
    textPrimary: 'text-gray-800',
    textSecondary: 'text-gray-500',
    textAccent: 'text-orange-600',
    border: 'border-orange-100',
    borderAccent: 'border-orange-300',
    headerBg: 'bg-orange-100',
    headerBorder: 'border-orange-200/50',
    headerLogoGradient: 'from-orange-500 to-amber-500',
    headerTitleGradient: 'from-orange-600 to-amber-600',
    headerLangActive: 'from-orange-500 to-amber-500',
    headerLangInactive: 'text-gray-600 hover:bg-orange-200/50',
    headerLangBg: 'bg-white/60 border-orange-100',
    headerAddBtn: 'from-orange-500 to-amber-500',
    headerAddBtnHover: 'hover:from-orange-600 hover:to-amber-600',
    headerText: 'text-white',
    bottomNavBg: 'bg-white/95',
    bottomNavBorder: 'border-orange-100',
    bottomNavActive: 'text-orange-600',
    bottomNavActiveBg: 'bg-orange-50',
    bottomNavInactive: 'text-gray-500 hover:text-orange-500',
    catFilterActive: 'from-orange-500 to-amber-500',
    catFilterInactive: 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600',
    tabActive: 'text-orange-600',
    tabActiveBorder: 'border-orange-500',
    tabActiveBg: 'bg-orange-50',
    inputBg: 'bg-white',
    inputText: 'text-gray-800',
    inputBorder: 'border-gray-200',
    inputPlaceholder: 'placeholder-gray-400',
    modalBg: 'bg-white',
    modalBorder: 'border-orange-100',
    modalHeaderBg: 'bg-orange-50',
    label: 'text-gray-700',
  },
  lavender: {
    id: 'lavender',
    name: { ru: 'Лаванда', en: 'Lavender', de: 'Lavendel' },
    bgPrimary: 'bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50',
    bgSecondary: 'bg-white',
    bgCard: 'bg-white',
    accentPrimary: 'bg-violet-500',
    accentSecondary: 'bg-purple-500',
    accentGradient: 'bg-gradient-to-r from-violet-500 to-purple-500',
    accentHover: 'hover:from-violet-600 hover:to-purple-600',
    textPrimary: 'text-gray-800',
    textSecondary: 'text-gray-500',
    textAccent: 'text-violet-600',
    border: 'border-violet-100',
    borderAccent: 'border-violet-300',
    headerBg: 'bg-gradient-to-r from-purple-50 via-violet-50 to-indigo-50',
    headerBorder: 'border-violet-200/50',
    headerLogoGradient: 'from-violet-500 to-purple-500',
    headerTitleGradient: 'from-violet-600 to-purple-600',
    headerLangActive: 'from-violet-500 to-purple-500',
    headerLangInactive: 'text-gray-600 hover:bg-violet-100/50',
    headerLangBg: 'bg-white/60 border-violet-100',
    headerAddBtn: 'from-violet-500 to-purple-500',
    headerAddBtnHover: 'hover:from-violet-600 hover:to-purple-600',
    headerText: 'text-white',
    bottomNavBg: 'bg-white/95',
    bottomNavBorder: 'border-violet-100',
    bottomNavActive: 'text-violet-600',
    bottomNavActiveBg: 'bg-violet-50',
    bottomNavInactive: 'text-gray-500 hover:text-violet-500',
    catFilterActive: 'from-violet-500 to-purple-500',
    catFilterInactive: 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600',
    tabActive: 'text-violet-600',
    tabActiveBorder: 'border-violet-500',
    tabActiveBg: 'bg-violet-50',
    inputBg: 'bg-white',
    inputText: 'text-gray-800',
    inputBorder: 'border-gray-200',
    inputPlaceholder: 'placeholder-gray-400',
    modalBg: 'bg-white',
    modalBorder: 'border-violet-100',
    modalHeaderBg: 'bg-gradient-to-r from-purple-50 to-violet-50',
    label: 'text-gray-700',
  },
};

interface ThemeContextType {
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('light');

  useEffect(() => {
    const saved = localStorage.getItem('smartrecipe-theme') as ThemeId | null;
    if (saved && themes[saved]) {
      setThemeId(saved);
    }
  }, []);

  const handleSetThemeId = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem('smartrecipe-theme', id);
  };

  const theme = themes[themeId];

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId: handleSetThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
