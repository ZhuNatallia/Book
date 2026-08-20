import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Language } from './translations';

export type ThemeId = 'light' | 'dark' | 'turquoise' | 'pumpkin' | 'lavender';

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
    bgPrimary: 'bg-[#eef2f6]',
    bgSecondary: 'bg-[#f7f9fc]',
    bgCard: 'bg-[#eef2f6]',
    accentPrimary: 'bg-[#ff9d6a]',
    accentSecondary: 'bg-[#ffc38a]',
    accentGradient: 'bg-gradient-to-r from-[#ff9d6a] to-[#ffc38a]',
    accentHover: 'hover:brightness-105',
    textPrimary: 'text-[#3a4250]',
    textSecondary: 'text-[#7b8494]',
    textAccent: 'text-[#e07a45]',
    border: 'border-transparent',
    borderAccent: 'border-[#ff9d6a]/40',
    headerBg: 'bg-[#eef2f6]/90',
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
    inputBg: 'bg-[#eef2f6]',
    inputText: 'text-[#3a4250]',
    inputBorder: 'border-transparent',
    inputPlaceholder: 'placeholder-[#7b8494]',
    modalBg: 'bg-[#eef2f6]',
    modalBorder: 'border-transparent',
    modalHeaderBg: 'bg-[#f7f9fc]',
    label: 'text-[#3a4250]',
    ...chrome,
  },
  dark: {
    id: 'dark',
    name: { ru: 'Темная', en: 'Dark', de: 'Dunkel', uk: 'Темна', pl: 'Ciemny', it: 'Scuro', es: 'Oscuro', fr: 'Sombre', kk: 'Қараңғы' },
    bgPrimary: 'bg-[#16181d]',
    bgSecondary: 'bg-[#1e2128]',
    bgCard: 'bg-[#1e2128]',
    accentPrimary: 'bg-[#00e5ff]',
    accentSecondary: 'bg-[#c026d3]',
    accentGradient: 'bg-gradient-to-r from-[#00e5ff] to-[#c026d3]',
    accentHover: 'hover:brightness-110',
    textPrimary: 'text-zinc-100',
    textSecondary: 'text-zinc-400',
    textAccent: 'text-cyan-300',
    border: 'border-transparent',
    borderAccent: 'border-cyan-400/40',
    headerBg: 'bg-[#16181d]/90',
    headerBorder: 'border-transparent',
    headerLogoGradient: 'from-[#00e5ff] to-[#c026d3]',
    headerTitleGradient: 'from-cyan-300 to-fuchsia-400',
    headerLangActive: 'from-[#00e5ff] to-[#c026d3]',
    headerLangInactive: 'text-zinc-400',
    headerLangBg: '',
    headerAddBtn: 'from-[#00e5ff] to-[#c026d3]',
    headerAddBtnHover: 'hover:brightness-110',
    headerText: 'text-white',
    bottomNavBg: '',
    bottomNavBorder: 'border-transparent',
    bottomNavActive: 'text-cyan-300',
    bottomNavActiveBg: 'bg-white/5',
    bottomNavInactive: 'text-zinc-500',
    catFilterActive: 'from-[#00e5ff] to-[#c026d3]',
    catFilterInactive: 'neu-chip',
    tabActive: 'text-cyan-300',
    tabActiveBorder: 'border-cyan-400',
    tabActiveBg: 'bg-cyan-400/10',
    inputBg: 'bg-white/5',
    inputText: 'text-zinc-100',
    inputBorder: 'border-cyan-400/20',
    inputPlaceholder: 'placeholder-zinc-500',
    modalBg: 'bg-[#1e2128]',
    modalBorder: 'border-transparent',
    modalHeaderBg: 'bg-[#16181d]',
    label: 'text-zinc-300',
    ...chrome,
  },
  turquoise: {
    id: 'turquoise',
    name: { ru: 'Цветная', en: 'Colorful', de: 'Bunt', uk: 'Кольорова', pl: 'Kolorowy', it: 'Colorata', es: 'Colorida', fr: 'Colorée', kk: 'Түсті' },
    bgPrimary: 'bg-[#e7f6f4]',
    bgSecondary: 'bg-[#f4fcfb]',
    bgCard: 'bg-[#f7fffe]',
    accentPrimary: 'bg-[#ff9aa2]',
    accentSecondary: 'bg-[#b5ead7]',
    accentGradient: 'bg-gradient-to-r from-[#ff9aa2] to-[#b5ead7]',
    accentHover: 'hover:brightness-105',
    textPrimary: 'text-[#35555a]',
    textSecondary: 'text-[#6e8b90]',
    textAccent: 'text-[#d97a82]',
    border: 'border-transparent',
    borderAccent: 'border-[#ff9aa2]/40',
    headerBg: 'bg-[#e7f6f4]/90',
    headerBorder: 'border-transparent',
    headerLogoGradient: 'from-[#ff9aa2] to-[#b5ead7]',
    headerTitleGradient: 'from-[#d97a82] to-[#7ab8a8]',
    headerLangActive: 'from-[#ff9aa2] to-[#b5ead7]',
    headerLangInactive: 'text-[#6e8b90]',
    headerLangBg: '',
    headerAddBtn: 'from-[#ff9aa2] to-[#b5ead7]',
    headerAddBtnHover: 'hover:brightness-105',
    headerText: 'text-white',
    bottomNavBg: '',
    bottomNavBorder: 'border-transparent',
    bottomNavActive: 'text-[#d97a82]',
    bottomNavActiveBg: 'bg-white/50',
    bottomNavInactive: 'text-[#6e8b90]',
    catFilterActive: 'from-[#ff9aa2] to-[#b5ead7]',
    catFilterInactive: 'neu-chip',
    tabActive: 'text-[#d97a82]',
    tabActiveBorder: 'border-[#ff9aa2]',
    tabActiveBg: 'bg-[#ff9aa2]/10',
    inputBg: 'bg-[#e7f6f4]',
    inputText: 'text-[#35555a]',
    inputBorder: 'border-transparent',
    inputPlaceholder: 'placeholder-[#6e8b90]',
    modalBg: 'bg-[#f7fffe]',
    modalBorder: 'border-transparent',
    modalHeaderBg: 'bg-[#e7f6f4]',
    label: 'text-[#35555a]',
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
  }, [themeId]);

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
