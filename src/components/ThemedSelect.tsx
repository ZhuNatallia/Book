import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../i18n/ThemeContext';

export interface ThemedSelectOption {
  value: string;
  label: string;
}

interface ThemedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  disabled,
}: ThemedSelectProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const selected = options.find((o) => o.value === value);

  const updateRect = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onWin = () => updateRect();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const menu =
    open && rect
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 160),
              zIndex: 80,
              background: 'var(--surf-2)',
              color: 'var(--text)',
            }}
            className="rounded-xl py-1 max-h-56 overflow-auto shadow-lg border border-[color:var(--stroke)]"
          >
            {options.map((opt) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-base ${
                    opt.value === value ? theme.tabActiveBg : ''
                  }`}
                  style={{ color: 'var(--text)' }}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left flex items-center justify-between gap-2 ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'opacity-60'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-60" />
      </button>
      {menu}
    </>
  );
}
