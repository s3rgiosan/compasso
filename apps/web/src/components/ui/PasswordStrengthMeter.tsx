import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthMeterProps {
  password: string;
}

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function getStrength(password: string): StrengthLevel {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return 1;
  if (score === 2) return 2;
  if (score === 3) return 3;
  return 4;
}

const STRENGTH_CONFIG: Record<StrengthLevel, { key: string; color: string; bg: string }> = {
  0: { key: '', color: 'bg-gray-200', bg: 'bg-gray-200' },
  1: { key: 'auth.strengthWeak', color: 'bg-red-500', bg: 'bg-red-500' },
  2: { key: 'auth.strengthFair', color: 'bg-orange-500', bg: 'bg-orange-500' },
  3: { key: 'auth.strengthGood', color: 'bg-yellow-500', bg: 'bg-yellow-500' },
  4: { key: 'auth.strengthStrong', color: 'bg-green-500', bg: 'bg-green-500' },
};

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { t } = useTranslation();
  const strength = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  const config = STRENGTH_CONFIG[strength];

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strength ? config.bg : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t(config.key)}</p>
    </div>
  );
}
