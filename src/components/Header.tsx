import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { useTheme, themes, ThemeId } from '../i18n/ThemeContext';
import { ChefHat, Plus, Settings, ChevronRight, ArrowLeft, Check, LogOut, Scale, Users, User, CalendarDays, MessageCircle, Sparkles, Shield } from 'lucide-react';
import { ProfileSettings } from './ProfileSettings';
import { FeedbackForm } from './FeedbackForm';
import { PlanSettings } from './PlanSettings';
import { AccountSettings } from './AccountSettings';
import { usePlan } from '../i18n/PlanContext';
import { FullRecipe } from '../types';

export type BottomNavView = 'recipes' | 'shopping' | 'menu' | 'converter' | 'friends';

interface HeaderProps {
  onAddRecipe: () => void;
  onSignOut: () => void;
  onGoHome: () => void;
  compact?: boolean;
  userId: string;
  email?: string;
  online?: boolean;
  syncing?: boolean;
  openSettingsTo?: 'plan' | null;
  onOpenSettingsConsumed?: () => void;
  recipes: FullRecipe[];
}

type SettingsView = 'main' | 'language' | 'theme' | 'profile' | 'feedback' | 'plan' | 'account';

export function Header({
  onAddRecipe,
  onSignOut,
  onGoHome,
  compact = false,
  userId,
  email,
  online = true,
  syncing = false,
  openSettingsTo = null,
  onOpenSettingsConsumed,
  recipes,
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const { theme, themeId, setThemeId, momsPaper, setMomsPaper } = useTheme();
  const { isPlus } = usePlan();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowSettings(false);
        setSettingsView('main');
      }
    };
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  useEffect(() => {
    if (openSettingsTo !== 'plan') return;
    setShowSettings(true);
    setSettingsView('plan');
    onOpenSettingsConsumed?.();
  }, [openSettingsTo, onOpenSettingsConsumed]);

  const languages: { code: Language; flag: string; label: string }[] = [
    { code: 'ru', flag: '🇷🇺', label: 'Русский' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'uk', flag: '🇺🇦', label: 'Українська' },
    { code: 'pl', flag: '🇵🇱', label: 'Polski' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'kk', flag: '🇰🇿', label: 'Қазақша' },
  ];

  const currentLanguage = languages.find((l) => l.code === language) ?? languages[0];

  const themeOptions: { id: ThemeId; name: string; preview: string }[] = [
    { id: 'light', name: themes.light.name[language], preview: 'from-[#ff9d6a] to-[#ffc38a]' },
    { id: 'dark', name: themes.dark.name[language], preview: 'from-[#00e5ff] to-[#c026d3]' },
    { id: 'turquoise', name: themes.turquoise.name[language], preview: 'from-[#ff9aa2] to-[#b5ead7]' },
    { id: 'pumpkin', name: themes.pumpkin.name[language], preview: 'from-[#e8b89a] to-[#c5b4e3]' },
    { id: 'lavender', name: themes.lavender.name[language], preview: 'from-[#c5b4e3] to-[#a78bfa]' },
  ];

  const closeSettings = () => {
    setShowSettings(false);
    setSettingsView('main');
  };

  return (
    <header className={`sticky top-0 z-50 ${theme.headerBg}`}>
      <div className={`relative max-w-7xl mx-auto px-4 ${compact ? 'py-2' : 'py-4'}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-3 text-left"
            title={t('recipes')}
          >
            <div className={`w-10 h-10 bg-gradient-to-br ${theme.headerLogoGradient} rounded-2xl flex items-center justify-center neu-btn-primary`}>
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <h1 className={`text-xl font-bold bg-gradient-to-r ${theme.headerTitleGradient} bg-clip-text text-transparent ${compact ? 'hidden' : ''}`}>
              {t('appName')}
            </h1>
          </button>

          <div className="flex items-center gap-3">
            {!online && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${theme.chip}`}>{t('offline')}</span>
            )}
            {online && syncing && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${theme.chip}`}>{t('syncing')}</span>
            )}
            <button
              onClick={onAddRecipe}
              className={`${theme.btnPrimary} flex items-center gap-2 px-4 py-2 font-medium`}
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
                className={`${theme.iconBtn} p-2.5`}
              >
                <Settings className={`w-5 h-5 ${theme.textAccent}`} />
              </button>

              {showSettings && (
                <div className={`absolute right-0 top-12 w-80 max-h-[80vh] overflow-y-auto ${theme.card} neu-popover z-[80]`}>
                  {settingsView === 'main' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary}`}>
                        <p className={`text-base font-semibold ${theme.textPrimary}`}>
                          {t('settingsTitle')}
                        </p>
                      </div>
                      <div className="p-1">
                        <button
                          onClick={() => setSettingsView('profile')}
                          className={`neu-menu-item w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <User className={`w-5 h-5 ${theme.textAccent}`} />
                            <span className="text-base font-medium">{t('yourProfile')}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                        </button>
                        <button
                          onClick={() => setSettingsView('account')}
                          className={`neu-menu-item w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <Shield className={`w-5 h-5 ${theme.textAccent}`} />
                            <span className="text-base font-medium">{t('accountTitle')}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                        </button>
                        <button
                          onClick={() => setSettingsView('plan')}
                          className={`neu-menu-item w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <Sparkles className={`w-5 h-5 ${theme.textAccent}`} />
                            <span className="text-base font-medium">{t('planTitle')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${theme.textSecondary}`}>
                              {isPlus ? t('planPlus') : t('planFree')}
                            </span>
                            <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                          </div>
                        </button>
                        <button
                          onClick={() => setSettingsView('language')}
                          className={`neu-menu-item w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{currentLanguage.flag}</span>
                            <span className="text-base font-medium">{t('languageLabel')}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                        </button>
                        <button
                          onClick={() => setSettingsView('theme')}
                          className={`neu-menu-item w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${themeOptions.find(t => t.id === themeId)?.preview || 'from-amber-400 to-rose-400'}`} />
                            <span className="text-base font-medium">{t('themeLabel')}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                        </button>
                        <button
                          onClick={() => setSettingsView('feedback')}
                          className={`neu-menu-item w-full flex items-center justify-between px-4 py-3 rounded-xl ${theme.textPrimary} transition-colors`}
                        >
                          <div className="flex items-center gap-3">
                            <MessageCircle className={`w-5 h-5 ${theme.textAccent}`} />
                            <span className="text-base font-medium">{t('feedbackTitle')}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${theme.textSecondary}`} />
                        </button>
                        <button
                          onClick={onSignOut}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors`}
                        >
                          <LogOut className="w-5 h-5" />
                          <span className="text-base font-medium">{t('authSignOut')}</span>
                        </button>
                      </div>
                    </>
                  )}

                  {settingsView === 'profile' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-base font-semibold ${theme.textPrimary}`}>
                          {t('yourProfile')}
                        </p>
                      </div>
                      <ProfileSettings userId={userId} email={email} />
                    </>
                  )}

                  {settingsView === 'account' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-base font-semibold ${theme.textPrimary}`}>
                          {t('accountTitle')}
                        </p>
                      </div>
                      <AccountSettings
                        userId={userId}
                        email={email}
                        online={online}
                        recipes={recipes}
                        onDeleted={onSignOut}
                      />
                    </>
                  )}

                  {settingsView === 'plan' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-base font-semibold ${theme.textPrimary}`}>
                          {t('planTitle')}
                        </p>
                      </div>
                      <PlanSettings />
                    </>
                  )}

                  {settingsView === 'language' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-base font-semibold ${theme.textPrimary}`}>
                          {t('languageLabel')}
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
                              <span className="text-base font-medium">{lang.label}</span>
                            </div>
                            {language === lang.code && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {settingsView === 'feedback' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-base font-semibold ${theme.textPrimary}`}>
                          {t('feedbackTitle')}
                        </p>
                      </div>
                      <FeedbackForm userId={userId} email={email} online={online} />
                    </>
                  )}

                  {settingsView === 'theme' && (
                    <>
                      <div className={`p-3 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-2`}>
                        <button onClick={() => setSettingsView('main')} className={`p-1 rounded hover:bg-gray-100 ${theme.textSecondary}`}>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className={`text-base font-semibold ${theme.textPrimary}`}>
                          {t('themeLabel')}
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
                                <span className={`text-sm font-medium ${isActive ? theme.textAccent : theme.textSecondary}`}>
                                  {opt.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMomsPaper(!momsPaper)}
                          className={`mt-3 w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl ${
                            momsPaper ? theme.tabActiveBg : ''
                          }`}
                        >
                          <div className="text-left">
                            <p className={`text-sm font-medium ${theme.textPrimary}`}>{t('notebookMoms')}</p>
                            <p className={`text-xs mt-0.5 ${theme.textSecondary}`}>{t('notebookMomsHint')}</p>
                          </div>
                          {momsPaper && <Check className={`w-4 h-4 shrink-0 ${theme.textAccent}`} />}
                        </button>
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
  activeView: BottomNavView;
  onViewChange: (view: BottomNavView) => void;
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
    { id: 'menu' as const, icon: CalendarDays, label: t('menu') },
    { id: 'converter' as const, icon: Scale, label: t('measurementConverter') },
    { id: 'friends' as const, icon: Users, label: t('friends') },
  ];

  return (
    <nav className="fixed bottom-3 left-3 right-3 z-50">
      <div className="max-w-xl mx-auto">
        <div className={`neu-nav flex justify-around py-2 rounded-[28px]`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl transition-all duration-200 min-h-[48px] min-w-0 flex-1 ${
                  isActive
                    ? `${theme.bottomNavActive} ${theme.bottomNavActiveBg}`
                    : theme.bottomNavInactive
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[11px] font-medium leading-tight text-center truncate w-full">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
