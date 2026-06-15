import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { useTheme, themes, ThemeId } from '../i18n/ThemeContext';
import { ChefHat, Plus, Settings, ChevronRight, ArrowLeft, Check } from 'lucide-react';

interface HeaderProps {
  onAddRecipe: () => void;
}

type SettingsView = 'main' | 'language' | 'theme';

export function Header({ onAddRecipe }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const { theme, themeId, setThemeId } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSettings(false);
        setSettingsView('main');
      }
    };
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const languages: { code: Language; flag: string; label: string }[] = [
    { code: 'ru', flag: '🇷🇺', label: 'Русский' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  ];

  const themeOptions: { id: ThemeId; name: string; preview: string }[] = [
    { id: 'light', name: themes.light.name[language], preview: 'from-amber-400 to-rose-400' },
    { id: 'dark', name: themes.dark.name[language], preview: 'from-amber-500 to-orange-500' },
    { id: 'turquoise', name: themes.turquoise.name[language], preview: 'from-teal-400 to-cyan-400' },
    { id: 'pumpkin', name: themes.pumpkin.name[language], preview: 'from-orange-400 to-amber-400' },
    { id: 'lavender', name: themes.lavender.name[language], preview: 'from-violet-400 to-purple-400' },
  ];

  const closeSettings = () => {
    setShowSettings(false);
    setSettingsView('main');
  };

  return (
    <header className={`sticky top-0 z-50 ${theme.headerBg} backdrop-blur-md border-b ${theme.headerBorder} shadow-sm`}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${theme.headerLogoGradient} rounded-xl flex items-center justify-center shadow-md`}>
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <h1 className={`text-xl font-bold bg-gradient-to-r ${theme.headerTitleGradient} bg-clip-text text-transparent`}>
              {t('appName')}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onAddRecipe}
              className={`flex items-center gap-2 bg-gradient-to-r ${theme.headerAddBtn} ${theme.headerAddBtnHover} ${theme.headerText} px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-200 font-medium`}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">{t('addRecipe')}</span>
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setSettingsView('main');
                }}
                className={`p-2.5 rounded-full ${theme.headerLangBg} shadow-sm hover:shadow-md transition-all`}
              >
                <Settings className={`w-5 h-5 ${theme.textAccent}`} />
              </button>

              {showSettings && (
                <div className={`absolute right-0 top-12 w-72 ${theme.bgCard} rounded-2xl shadow-2xl border ${theme.border} overflow-hidden z-50`}>
                  {settingsView === 'main' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary}`}>
                        <p className={`text-sm font-semibold ${theme.textPrimary}`}>
                          {language === 'ru' ? 'Настройки' : language === 'de' ? 'Einstellungen' : 'Settings'}
                        </p>
                      </div>
                      <div className="p-1">
                        <button
                          onClick={() => setSettingsView('language')}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} hover:bg-gray-50 transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {language === 'ru' ? '🇷🇺' : language === 'de' ? '🇩🇪' : '🇬🇧'}
                            </span>
                            <span className="text-sm font-medium">
                              {language === 'ru' ? 'Язык' : language === 'de' ? 'Sprache' : 'Language'}
                            </span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                        </button>
                        <button
                          onClick={() => setSettingsView('theme')}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} hover:bg-gray-50 transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${themeOptions.find(t => t.id === themeId)?.preview || 'from-amber-400 to-rose-400'}`} />
                            <span className="text-sm font-medium">
                              {language === 'ru' ? 'Палитра' : language === 'de' ? 'Palette' : 'Theme'}
                            </span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                        </button>
                      </div>
                    </>
                  )}

                  {settingsView === 'language' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-sm font-semibold ${theme.textPrimary}`}>
                          {language === 'ru' ? 'Язык' : language === 'de' ? 'Sprache' : 'Language'}
                        </p>
                      </div>
                      <div className="p-1">
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              setLanguage(lang.code);
                              closeSettings();
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                              language === lang.code
                                ? `${theme.tabActiveBg} ${theme.tabActive}`
                                : `${theme.textPrimary} hover:bg-gray-50`
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{lang.flag}</span>
                              <span className="text-sm font-medium">{lang.label}</span>
                            </div>
                            {language === lang.code && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {settingsView === 'theme' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-sm font-semibold ${theme.textPrimary}`}>
                          {language === 'ru' ? 'Палитра' : language === 'de' ? 'Palette' : 'Theme'}
                        </p>
                      </div>
                      <div className="p-2">
                        <div className="grid grid-cols-2 gap-2">
                          {themeOptions.map((opt) => {
                            const isActive = themeId === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  setThemeId(opt.id);
                                  closeSettings();
                                }}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                                  isActive
                                    ? `${theme.tabActiveBg} ring-2 ring-offset-1 ${theme.borderAccent}`
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${opt.preview} shadow-md flex items-center justify-center`}>
                                  {isActive && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <span className={`text-xs font-medium ${isActive ? theme.textAccent : theme.textSecondary}`}>
                                  {opt.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function BottomNav({
  activeView,
  onViewChange,
}: {
  activeView: 'recipes' | 'shopping' | 'utilities';
  onViewChange: (view: 'recipes' | 'shopping' | 'utilities') => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const navItems = [
    { id: 'recipes' as const, icon: ChefHat, label: t('recipes') },
    {
      id: 'shopping' as const,
      icon: () => (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
      label: t('shoppingList'),
    },
    { id: 'utilities' as const, icon: Settings, label: t('utilities') },
  ];

  return (
    <nav className={`fixed bottom-0 left-0 right-0 ${theme.bottomNavBg} backdrop-blur-md border-t ${theme.bottomNavBorder} shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50`}>
      <div className="max-w-md mx-auto">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? `${theme.bottomNavActive} ${theme.bottomNavActiveBg}`
                    : theme.bottomNavInactive
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
