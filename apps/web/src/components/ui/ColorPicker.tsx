import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const isPreset = COLORS.some((c) => c.value === value);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {COLORS.map((color) => (
        <button
          key={color.value}
          onClick={() => onChange(color.value)}
          className={cn(
            'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
            value === color.value
              ? 'border-gray-900 scale-110'
              : 'border-transparent',
          )}
          style={{ backgroundColor: color.value }}
          title={color.label}
          type="button"
        />
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 overflow-hidden',
          !isPreset ? 'border-gray-900 scale-110' : 'border-gray-300',
        )}
        style={{
          background: !isPreset
            ? value
            : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
        }}
        title={t('categories.customColor')}
      >
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </button>
    </div>
  );
}
