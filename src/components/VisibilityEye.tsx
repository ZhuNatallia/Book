import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import {
  ALL_CIRCLES,
  FRIEND_CIRCLES,
  FriendCircle,
  circleLabelKey,
} from '../lib/friendCircles';

interface VisibilityEyeProps {
  circles: FriendCircle[];
  onChange: (circles: FriendCircle[]) => void;
  buttonClassName: string;
  iconClassName: string;
}

export function VisibilityEye({
  circles,
  onChange,
  buttonClassName,
  iconClassName,
}: VisibilityEyeProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = circles.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggleCircle = (circle: FriendCircle) => {
    const next = circles.includes(circle)
      ? circles.filter((item) => item !== circle)
      : [...FRIEND_CIRCLES.filter((item) => circles.includes(item) || item === circle)];
    onChange(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!visible) {
            onChange(ALL_CIRCLES);
            setOpen(true);
            return;
          }
          setOpen((prev) => !prev);
        }}
        title={visible ? t('whoSeesRecipe') : t('hiddenFromFriends')}
        className={buttonClassName}
      >
        {visible ? <Eye className={iconClassName} /> : <EyeOff className={iconClassName} />}
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full mt-1 z-30 min-w-[10.5rem] rounded-xl border p-2 shadow-lg ${theme.modalBg} ${theme.modalBorder}`}
          onClick={(e) => e.stopPropagation()}
        >
          <p className={`text-[11px] font-semibold mb-1.5 px-1 ${theme.textSecondary}`}>
            {t('whoSeesRecipe')}
          </p>
          <div className="flex flex-col gap-1">
            {FRIEND_CIRCLES.map((circle) => {
              const on = circles.includes(circle);
              return (
                <button
                  key={circle}
                  type="button"
                  onClick={() => toggleCircle(circle)}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold ${
                    on ? theme.chipActive : theme.chip
                  }`}
                >
                  {t(circleLabelKey(circle))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CircleChips({
  value,
  onChange,
}: {
  value: FriendCircle;
  onChange: (circle: FriendCircle) => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  return (
    <div className="flex flex-wrap gap-2">
      {FRIEND_CIRCLES.map((circle) => (
        <button
          key={circle}
          type="button"
          onClick={() => onChange(circle)}
          className={`px-3 py-1.5 text-sm font-medium ${
            value === circle ? theme.chipActive : theme.chip
          }`}
        >
          {t(circleLabelKey(circle))}
        </button>
      ))}
    </div>
  );
}
