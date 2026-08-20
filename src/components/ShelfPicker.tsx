import { useState } from 'react';
import { PRESET_SHELVES, shelfLabel } from '../data/shelves';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';

interface ShelfPickerProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  extraTags?: string[];
}

export function ShelfPicker({ tags, onChange, extraTags = [] }: ShelfPickerProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [custom, setCustom] = useState('');

  const allCustom = [...new Set([...extraTags, ...tags.filter((tag) => !PRESET_SHELVES.includes(tag as never))])];

  const toggle = (tag: string) => {
    onChange(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag]);
  };

  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    if (!tags.includes(name)) onChange([...tags, name]);
    setCustom('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_SHELVES.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`px-3 py-1.5 text-sm font-medium ${tags.includes(tag) ? theme.chipActive : theme.chip}`}
          >
            {shelfLabel(tag, t)}
          </button>
        ))}
        {allCustom.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`px-3 py-1.5 text-sm font-medium ${tags.includes(tag) ? theme.chipActive : theme.chip}`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={t('addShelfPlaceholder')}
          className={`flex-1 px-3 py-2 text-base ${theme.input}`}
        />
        <button type="button" onClick={addCustom} className={`shrink-0 px-3 py-2 text-sm font-medium ${theme.btnSoft}`}>
          {t('addShelf')}
        </button>
      </div>
    </div>
  );
}
