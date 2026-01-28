import type { SupportedLocale } from './types.js';

export type BankId = string;

// Bank metadata
export interface BankConfig {
  id: string;
  name: string;
  country: string;
  currency: string;
  dateFormat: string;
  decimalFormat: 'european' | 'standard'; // European: 1.234,56 | Standard: 1,234.56
}

// Default categories (shared across all banks)
export interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Uncategorized', color: '#a1a1aa', icon: 'help-circle' },
  { name: 'Groceries', color: '#22c55e', icon: 'shopping-cart' },
  { name: 'Fuel', color: '#f97316', icon: 'fuel' },
  { name: 'Health', color: '#ef4444', icon: 'heart' },
  { name: 'Fitness', color: '#8b5cf6', icon: 'dumbbell' },
  { name: 'Entertainment', color: '#ec4899', icon: 'film' },
  { name: 'Dining', color: '#f59e0b', icon: 'utensils' },
  { name: 'Shopping', color: '#6366f1', icon: 'bag' },
  { name: 'Utilities', color: '#14b8a6', icon: 'zap' },
  { name: 'Housing', color: '#0ea5e9', icon: 'home' },
  { name: 'Insurance', color: '#64748b', icon: 'shield' },
  { name: 'Income', color: '#10b981', icon: 'trending-up' },
  { name: 'Transfers', color: '#3b82f6', icon: 'repeat' },
  { name: 'Fees', color: '#94a3b8', icon: 'percent' },
  { name: 'Cash', color: '#78716c', icon: 'banknote' },
  { name: 'Other', color: '#a1a1aa', icon: 'more-horizontal' },
];

export const CATEGORY_NAME_TRANSLATIONS: Record<string, Record<SupportedLocale, string>> = {
  'Uncategorized': { en: 'Uncategorized', pt: 'Sem Categoria' },
  'Groceries':     { en: 'Groceries',     pt: 'Mercearia' },
  'Fuel':          { en: 'Fuel',           pt: 'Combustível' },
  'Health':        { en: 'Health',         pt: 'Saúde' },
  'Fitness':       { en: 'Fitness',        pt: 'Fitness' },
  'Entertainment': { en: 'Entertainment',  pt: 'Entretenimento' },
  'Dining':        { en: 'Dining',         pt: 'Restauração' },
  'Shopping':      { en: 'Shopping',       pt: 'Compras' },
  'Utilities':     { en: 'Utilities',      pt: 'Serviços' },
  'Housing':       { en: 'Housing',        pt: 'Habitação' },
  'Insurance':     { en: 'Insurance',      pt: 'Seguros' },
  'Income':        { en: 'Income',         pt: 'Receitas' },
  'Transfers':     { en: 'Transfers',      pt: 'Transferências' },
  'Fees':          { en: 'Fees',           pt: 'Taxas' },
  'Cash':          { en: 'Cash',           pt: 'Dinheiro' },
  'Other':         { en: 'Other',          pt: 'Outros' },
};

export function getLocalizedCategories(locale: SupportedLocale): DefaultCategory[] {
  return DEFAULT_CATEGORIES.map(cat => ({
    ...cat,
    name: CATEGORY_NAME_TRANSLATIONS[cat.name]?.[locale] ?? cat.name,
  }));
}

// Default workspace translations
export const DEFAULT_WORKSPACE_TRANSLATIONS: Record<'name' | 'description', Record<SupportedLocale, string>> = {
  name:        { en: 'Personal',              pt: 'Pessoal' },
  description: { en: 'My personal finances',  pt: 'As minhas finanças pessoais' },
};

export function getLocalizedWorkspaceDefaults(locale: SupportedLocale): { name: string; description: string } {
  return {
    name: DEFAULT_WORKSPACE_TRANSLATIONS.name[locale] ?? DEFAULT_WORKSPACE_TRANSLATIONS.name.en,
    description: DEFAULT_WORKSPACE_TRANSLATIONS.description[locale] ?? DEFAULT_WORKSPACE_TRANSLATIONS.description.en,
  };
}

// API endpoints
export const API_ENDPOINTS = {
  DASHBOARD: '/api/dashboard',
  TRANSACTIONS: '/api/transactions',
  UPLOAD: '/api/upload',
  CONFIRM_TRANSACTIONS: '/api/transactions/confirm',
  CATEGORIES: '/api/categories',
} as const;
