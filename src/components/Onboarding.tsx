import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { ChefHat, ShoppingCart, Mic, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      icon: ChefHat,
      title: t('onb1Title'),
      desc: t('onb1Desc'),
      gradient: 'from-orange-400 to-rose-400',
      bg: 'from-orange-50 to-rose-50',
    },
    {
      icon: ShoppingCart,
      title: t('onb2Title'),
      desc: t('onb2Desc'),
      gradient: 'from-teal-400 to-cyan-400',
      bg: 'from-teal-50 to-cyan-50',
    },
    {
      icon: Mic,
      title: t('onb3Title'),
      desc: t('onb3Desc'),
      gradient: 'from-green-400 to-emerald-400',
      bg: 'from-green-50 to-emerald-50',
    },
  ];

  const current = slides[slide];
  const Icon = current.icon;
  const isLast = slide === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setSlide((s) => s + 1);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col bg-gradient-to-br ${current.bg} transition-all duration-500`}>
      <div className="flex justify-end p-4">
        <button
          onClick={onComplete}
          className={`text-sm font-medium ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}
        >
          {t('onbSkip')}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md mx-auto w-full">
        <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${current.gradient} flex items-center justify-center shadow-2xl mb-8 transform transition-all duration-500 hover:scale-105`}>
          <Icon className="w-16 h-16 text-white" strokeWidth={1.5} />
        </div>

        <h2 className={`text-2xl font-bold text-center ${theme.textPrimary} mb-3 transition-all duration-300`}>
          {current.title}
        </h2>
        <p className={`text-center ${theme.textSecondary} text-base leading-relaxed transition-all duration-300`}>
          {current.desc}
        </p>
      </div>

      <div className="flex flex-col items-center pb-10 px-8 max-w-md mx-auto w-full">
        <div className="flex gap-2 mb-8">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === slide
                  ? `w-8 bg-gradient-to-r ${current.gradient}`
                  : idx < slide
                    ? 'w-2 bg-gray-300'
                    : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className={`w-full py-4 bg-gradient-to-r ${current.gradient} text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2`}
        >
          {isLast ? t('onbStart') : t('onbNext')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
