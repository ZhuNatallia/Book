import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Language } from './translations';

export type ThemeId = 'light' | 'dark' | 'pumpkin' | 'lavender';

const chrome = {
  card: 'neu-card',
  btnPrimary: 'neu-btn-primary',
  btnSoft: 'neu-btn',
  iconBtn: 'neu-icon-btn',
  input: 'neu-input',
  chip: 'neu-chip',
  chipActive: 'neu-chip-active',
};

export interface Theme {
  id: ThemeId;
  name: Record<Language, string>;
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
  card: string;
  btnPrimary: string;
  btnSoft: string;
  iconBtn: string;
  input: string;
  chip: string;
  chipActive: string;
}

export const themes: Record<ThemeId, Theme> = {
  light: {
    id: 'light',
    name: { ru: 'Светлая', en: 'Light', de: 'Hell', uk: 'Світла', pl: 'Jasny', it: 'Chiaro', es: 'Claro', fr: 'Clair', kk: 'Ашық' },
    bgPrimary: 'bg-[#faf9f8]',
    bgSecondary: 'bg-white',
    bgCard: 'bg-[#faf9f8]',
    accentPrimary: 'bg-[#ff9d6a]',
    accentSecondary: 'bg-[#ffc38a]',
    accentGradient: 'bg-gradient-to-r from-[#ff9d6a] to-[#ffc38a]',
    accentHover: 'hover:brightness-105',
    textPrimary: 'text-[#3a4250]',
    textSecondary: 'text-[#7b8494]',
    textAccent: 'text-[#e07a45]',
    border: 'border-transparent',
    borderAccent: 'border-[#ff9d6a]/40',
    headerBg: 'bg-[#faf9f8]',
    headerBorder: 'border-transparent',
    headerLogoGradient: 'from-[#ff9d6a] to-[#ffc38a]',
    headerTitleGradient: 'from-[#e07a45] to-[#ff9d6a]',
    headerLangActive: 'from-[#ff9d6a] to-[#ffc38a]',
    headerLangInactive: 'text-[#7b8494]',
    headerLangBg: '',
    headerAddBtn: 'from-[#ff9d6a] to-[#ffc38a]',
    headerAddBtnHover: 'hover:brightness-105',
    headerText: 'text-white',
    bottomNavBg: '',
    bottomNavBorder: 'border-transparent',
    bottomNavActive: 'text-[#e07a45]',
    bottomNavActiveBg: 'bg-white/40',
    bottomNavInactive: 'text-[#7b8494]',
    catFilterActive: 'from-[#ff9d6a] to-[#ffc38a]',
    catFilterInactive: 'neu-chip',
    tabActive: 'text-[#e07a45]',
    tabActiveBorder: 'border-[#ff9d6a]',
    tabActiveBg: 'bg-[#ff9d6a]/10',
    inputBg: 'bg-white',
    inputText: 'text-[#3a4250]',
    inputBorder: 'border-transparent',
    inputPlaceholder: 'placeholder-[#7b8494]',
    modalBg: 'bg-[#faf9f8]',
    modalBorder: 'border-transparent',
    modalHeaderBg: 'bg-white',
    label: 'text-[#3a4250]',
    ...chrome,
  },
  dark: {
    id: 'dark',
    name: { ru: 'Темная', en: 'Dark', de: 'Dunkel', uk: 'Темна', pl: 'Ciemny', it: 'Scuro', es: 'Oscuro', fr: 'Sombre', kk: 'Қараңғы' },
    bgPrimary: 'bg-[#2c333d]',
    bgSecondary: 'bg-[#363e48]',
    bgCard: 'bg-[#2c333d]',
    accentPrimary: 'bg-[#00e5ff]',
    accentSecondary: 'bg-[#c026d3]',
    accentGradient: 'bg-gradient-to-r from-[#00e5ff] to-[#c026d3]',
    accentHover: 'hover:brightness-110',
    textPrimary: 'text-white',
    textSecondary: 'text-white/55',
    textAccent: 'text-cyan-200',
    border: 'border-white/15',
    borderAccent: 'border-white/30',
    headerBg: 'bg-[#2c333d]',
    headerBorder: 'border-white/10',
    headerLogoGradient: 'from-[#00e5ff] to-[#c026d3]',
    headerTitleGradient: 'from-cyan-200 to-fuchsia-300',
    headerLangActive: 'from-[#00e5ff] to-[#c026d3]',
    headerLangInactive: 'text-white/50',
    headerLangBg: '',
    headerAddBtn: 'from-[#00e5ff] to-[#c026d3]',
    headerAddBtnHover: 'hover:brightness-110',
    headerText: 'text-white',
    bottomNavBg: '',
    bottomNavBorder: 'border-white/10',
    bottomNavActive: 'text-cyan-200',
    bottomNavActiveBg: 'bg-white/15',
    bottomNavInactive: 'text-white/45',
    catFilterActive: 'from-[#00e5ff] to-[#c026d3]',
    catFilterInactive: 'neu-chip',
    tabActive: 'text-cyan-200',
    tabActiveBorder: 'border-white/35',
    tabActiveBg: 'bg-white/12',
    inputBg: 'bg-white/10',
    inputText: 'text-white',
    inputBorder: 'border-white/20',
    inputPlaceholder: 'placeholder-white/40',
    modalBg: 'bg-[#2c333d]',
    modalBorder: 'border-white/15',
    modalHeaderBg: 'bg-[#363e48]',
    label: 'text-white/80',
    ...chrome,
  },
  pumpkin: {
    id: 'pumpkin',
    name: { ru: 'Бежевая', en: 'Beige', de: 'Beige', uk: 'Бежева', pl: 'Beżowy', it: 'Beige', es: 'Beige', fr: 'Beige', kk: 'Беж' },
    bgPrimary: 'bg-[#f5eee6]',
    bgSecondary: 'bg-[#faf6f1]',
    bgCard: 'bg-[#fffaf5]',
    accentPrimary: 'bg-[#e8b89a]',
    accentSecondary: 'bg-[#c5b4e3]',
    accentGradient: 'bg-gradient-to-r from-[#e8b89a] to-[#c5b4e3]',
    accentHover: 'hover:brightness-105',
    textPrimary: 'text-[#3f3832]',
    textSecondary: 'text-[#8a8178]',
    textAccent: 'text-[#c48b66]',
    border: 'border-transparent',
    borderAccent: 'border-[#e8b89a]/50',
    headerBg: 'bg-[#f5eee6]/90',
    headerBorder: 'border-transparent',
    headerLogoGradient: 'from-[#e8b89a] to-[#c5b4e3]',
    headerTitleGradient: 'from-[#c48b66] to-[#9a86c4]',
    headerLangActive: 'from-[#e8b89a] to-[#c5b4e3]',
    headerLangInactive: 'text-[#8a8178]',
    headerLangBg: '',
    headerAddBtn: 'from-[#e8b89a] to-[#c5b4e3]',
    headerAddBtnHover: 'hover:brightness-105',
    headerText: 'text-[#3f3832]',
    bottomNavBg: '',
    bottomNavBorder: 'border-transparent',
    bottomNavActive: 'text-[#c48b66]',
    bottomNavActiveBg: 'bg-white/60',
    bottomNavInactive: 'text-[#8a8178]',
    catFilterActive: 'from-[#e8b89a] to-[#c5b4e3]',
    catFilterInactive: 'neu-chip',
    tabActive: 'text-[#c48b66]',
    tabActiveBorder: 'border-[#e8b89a]',
    tabActiveBg: 'bg-[#e8b89a]/15',
    inputBg: 'bg-[#f5eee6]',
    inputText: 'text-[#3f3832]',
    inputBorder: 'border-transparent',
    inputPlaceholder: 'placeholder-[#8a8178]',
    modalBg: 'bg-[#fffaf5]',
    modalBorder: 'border-transparent',
    modalHeaderBg: 'bg-[#f5eee6]',
    label: 'text-[#3f3832]',
    ...chrome,
  },
  lavender: {
    id: 'lavender',
    name: { ru: 'Лаванда', en: 'Lavender', de: 'Lavendel', uk: 'Лаванда', pl: 'Lawenda', it: 'Lavanda', es: 'Lavanda', fr: 'Lavande', kk: 'Лаванда' },
    bgPrimary: 'bg-[#efeaf8]',
    bgSecondary: 'bg-[#f7f4fc]',
    bgCard: 'bg-[#efeaf8]',
    accentPrimary: 'bg-[#c5b4e3]',
    accentSecondary: 'bg-[#a78bfa]',
    accentGradient: 'bg-gradient-to-r from-[#c5b4e3] to-[#a78bfa]',
    accentHover: 'hover:brightness-105',
    textPrimary: 'text-[#3d3554]',
    textSecondary: 'text-[#7d7396]',
    textAccent: 'text-[#7c6aad]',
    border: 'border-transparent',
    borderAccent: 'border-[#c5b4e3]/50',
    headerBg: 'bg-[#efeaf8]/90',
    headerBorder: 'border-transparent',
    headerLogoGradient: 'from-[#c5b4e3] to-[#a78bfa]',
    headerTitleGradient: 'from-[#7c6aad] to-[#a78bfa]',
    headerLangActive: 'from-[#c5b4e3] to-[#a78bfa]',
    headerLangInactive: 'text-[#7d7396]',
    headerLangBg: '',
    headerAddBtn: 'from-[#c5b4e3] to-[#a78bfa]',
    headerAddBtnHover: 'hover:brightness-105',
    headerText: 'text-white',
    bottomNavBg: '',
    bottomNavBorder: 'border-transparent',
    bottomNavActive: 'text-[#7c6aad]',
    bottomNavActiveBg: 'bg-white/40',
    bottomNavInactive: 'text-[#7d7396]',
    catFilterActive: 'from-[#c5b4e3] to-[#a78bfa]',
    catFilterInactive: 'neu-chip',
    tabActive: 'text-[#7c6aad]',
    tabActiveBorder: 'border-[#c5b4e3]',
    tabActiveBg: 'bg-[#c5b4e3]/15',
    inputBg: 'bg-[#efeaf8]',
    inputText: 'text-[#3d3554]',
    inputBorder: 'border-transparent',
    inputPlaceholder: 'placeholder-[#7d7396]',
    modalBg: 'bg-[#efeaf8]',
    modalBorder: 'border-transparent',
    modalHeaderBg: 'bg-[#f7f4fc]',
    label: 'text-[#3d3554]',
    ...chrome,
  },
};

interface ThemeContextType {
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  momsPaper: boolean;
  setMomsPaper: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('light');
  const [momsPaper, setMomsPaperState] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('smartrecipe-theme');
    if (saved && saved in themes) {
      setThemeId(saved as ThemeId);
    } else if (saved) {
      setThemeId('light');
      localStorage.setItem('smartrecipe-theme', 'light');
    }
    const paper = localStorage.getItem('smartrecipe-moms-paper');
    if (paper === 'off') setMomsPaperState(false);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
  }, [themeId]);

  const handleSetThemeId = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem('smartrecipe-theme', id);
  };

  const handleSetMomsPaper = (on: boolean) => {
    setMomsPaperState(on);
    localStorage.setItem('smartrecipe-moms-paper', on ? 'on' : 'off');
  };

  const theme = themes[themeId] ?? themes.light;

  return (
    <ThemeContext.Provider
      value={{ theme, themeId, setThemeId: handleSetThemeId, momsPaper, setMomsPaper: handleSetMomsPaper }}
    >
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
