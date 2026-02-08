import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  color?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  /** Extra items rendered at the end of the list (e.g. "Create new" action) */
  footer?: React.ReactNode;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  className,
  footer,
}: SearchableSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filteredOptions = useMemo(
    () => searchQuery
      ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : options,
    [options, searchQuery]
  );

  const selectedLabel = useMemo(
    () => options.find((o) => String(o.value) === value)?.label ?? options[0]?.label ?? '',
    [options, value]
  );

  const openDropdown = useCallback(() => {
    if (comboRef.current) {
      const rect = comboRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 300);
    }
    setIsOpen(true);
    setSearchQuery('');
    setHighlightedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const selectOption = useCallback((val: string) => {
    onChange(val);
    closeDropdown();
  }, [onChange, closeDropdown]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDropdown]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          selectOption(String(filteredOptions[highlightedIndex].value));
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  return (
    <div className={cn('relative', className)} ref={comboRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => isOpen ? closeDropdown() : openDropdown()}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {isOpen && (
        <div className={cn(
          'absolute left-0 z-50 w-full min-w-[200px] rounded-md border border-gray-200 bg-white shadow-lg',
          dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
        )}>
          <div className="flex items-center border-b px-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={t('common.search')}
              className="flex h-9 w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); setHighlightedIndex(0); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <ul ref={listRef} className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filteredOptions.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={String(opt.value) === value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                  highlightedIndex === i ? 'bg-gray-100' : 'hover:bg-gray-50',
                  String(opt.value) === value && 'font-medium',
                )}
                onClick={() => selectOption(String(opt.value))}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                {opt.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                <span className="truncate">{opt.label}</span>
              </li>
            ))}

            {filteredOptions.length === 0 && searchQuery && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t('common.noResults')}
              </li>
            )}
          </ul>
          {footer}
        </div>
      )}
    </div>
  );
}
