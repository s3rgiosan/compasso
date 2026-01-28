import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from 'i18next';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INTL_LOCALE_MAP: Record<string, string> = {
  en: 'en-GB',
  pt: 'pt-PT',
};

function getIntlLocale(): string {
  return INTL_LOCALE_MAP[i18n.language] || 'pt-PT';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(getIntlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonth(monthString: string): string {
  const [year, month] = monthString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(getIntlLocale(), {
    year: 'numeric',
    month: 'short',
  });
}
