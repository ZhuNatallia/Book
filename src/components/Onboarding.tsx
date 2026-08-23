import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { useTheme } from '../i18n/ThemeContext';
import { ArrowRight, BookOpen, CalendarDays, ShoppingBag } from 'lucide-react';

const TOUR_KEY = 'smartrecipe-tour-seen';
const LEGACY_ONBOARDING_KEY = 'smartrecipe-onboarding-seen';

export function hasSeenTour() {
  return Boolean(localStorage.getItem(TOUR_KEY) || localStorage.getItem(LEGACY_ONBOARDING_KEY));
}

function markTourSeen() {
  localStorage.setItem(TOUR_KEY, 'true');
}

function coverTitleLines(title: string): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 3) return words;
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

const LANGS: { code: Language; label: string }[] = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'uk', label: 'UK' },
  { code: 'pl', label: 'PL' },
  { code: 'it', label: 'IT' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'kk', label: 'KK' },
];

type Phase = 'cover' | 'ask' | 'tour';

interface OnboardingProps {
  onComplete: () => void;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>('cover');
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  const finish = (sawTour: boolean) => {
    if (sawTour || !hasSeenTour()) markTourSeen();
    onComplete();
  };

  const afterCover = () => {
    if (hasSeenTour()) {
      finish(true);
      return;
    }
    setPhase('ask');
  };

  const openCover = () => {
    if (open) return;
    if (prefersReducedMotion()) {
      afterCover();
      return;
    }
    setOpen(true);
  };

  useEffect(() => {
    if (phase !== 'cover') return;
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(openCover, 2800);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(afterCover, 900);
    return () => window.clearTimeout(timer);
  }, [open]);

  const slides = [
    {
      id: 'book',
      title: t('tourBookTitle'),
      desc: t('tourBookDesc'),
      icon: BookOpen,
    },
    {
      id: 'list',
      title: t('tourListTitle'),
      desc: t('tourListDesc'),
      icon: ShoppingBag,
    },
    {
      id: 'menu',
      title: t('tourMenuTitle'),
      desc: t('tourMenuDesc'),
      icon: CalendarDays,
    },
  ];

  if (phase === 'cover') {
    return (
      <div className={`book-stage min-h-screen flex flex-col items-center justify-center px-6 ${theme.bgPrimary}`}>
        <button
          type="button"
          className={`book ${open ? 'book-open' : ''}`}
          onClick={openCover}
          aria-label={t('openBook')}
        >
          <div className="book-page" />
          <div className="book-cover">
            <div className="book-plate">
              <h1 className="book-title">
                {coverTitleLines(t('myRecipeBook')).map((line) => (
                  <span key={line} className="book-title-line">
                    {line}
                  </span>
                ))}
              </h1>
              <p className="book-tagline">{t('bookTagline')}</p>
            </div>
          </div>
        </button>
        <p className="book-hint">{t('openBookHint')}</p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-5 max-w-sm">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLanguage(lang.code);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                language === lang.code ? theme.chipActive : theme.chip
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'ask') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-6 ${theme.bgPrimary}`}>
        <div className={`${theme.card} max-w-md w-full p-6 text-center`}>
          <h2 className={`text-2xl font-bold ${theme.textPrimary} mb-3`}>{t('tourAskTitle')}</h2>
          <p className={`${theme.textSecondary} text-base mb-8`}>{t('tourAskDesc')}</p>
          <button
            type="button"
            onClick={() => setPhase('tour')}
            className={`w-full py-3.5 mb-3 ${theme.btnPrimary} font-semibold`}
          >
            {t('tourWatch')}
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            className={`w-full py-3.5 ${theme.btnSoft} font-semibold ${theme.textPrimary}`}
          >
            {t('tourSkip')}
          </button>
        </div>
      </div>
    );
  }

  const current = slides[slide];
  const Icon = current.icon;
  const last = slide === slides.length - 1;

  return (
    <div className={`min-h-screen flex flex-col ${theme.bgPrimary}`}>
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={() => finish(true)}
          className={`text-sm font-medium ${theme.textSecondary}`}
        >
          {t('tourSkip')}
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        <div className="tour-photo mb-8">
          {current.id === 'book' && (
            <div className="tour-mock">
              <div className="tour-mock-card" />
              <div className="tour-mock-card" />
              <div className="tour-mock-card" />
            </div>
          )}
          {current.id === 'list' && (
            <div className="tour-mock-list">
              <span />
              <span />
              <span />
            </div>
          )}
          {current.id === 'menu' && (
            <div className="tour-mock-cal">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          <div className={`tour-photo-badge bg-gradient-to-br ${theme.headerLogoGradient}`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
        <h2 className={`text-2xl font-bold text-center ${theme.textPrimary} mb-3`}>{current.title}</h2>
        <p className={`text-center text-base ${theme.textSecondary}`}>{current.desc}</p>
      </div>
      <div className="flex flex-col items-center pb-10 px-8 max-w-md mx-auto w-full">
        <div className="flex gap-2 mb-8">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx === slide ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-[var(--shadow-dark)] opacity-40'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? finish(true) : setSlide((s) => s + 1))}
          className={`w-full py-4 ${theme.btnPrimary} font-semibold flex items-center justify-center gap-2`}
        >
          {last ? t('onbStart') : t('onbNext')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
