import { getDatabase } from '../db/database.js';
import type {
  DashboardData,
  DashboardSummary,
  CategoryBreakdown,
  MonthlyTrend,
  TransactionWithCategory,
} from '@compasso/shared';
import { getRecurringSummary } from './recurringDetector.js';
import { yearRange, monthRange } from '../utils/dateHelpers.js';

interface Filters {
  workspaceId: number;
  year?: number;
  month?: number;
  categoryId?: number;
}

export function getDashboardData(filters: Filters): DashboardData {
  const summary = getSummary(filters);
  const categoryBreakdown = getCategoryBreakdown(filters);
  const monthlyTrends = getMonthlyTrends(filters);
  const recentTransactions = getRecentTransactions(filters);
  const recurringSummary = getRecurringSummary(filters.workspaceId);

  return {
    summary,
    categoryBreakdown,
    monthlyTrends,
    recentTransactions,
    recurringSummary,
  };
}

function buildDateFilter(filters: Filters): { where: string; params: unknown[] } {
  // Always filter by workspace via ledger join
  const conditions: string[] = ['l.workspace_id = ?'];
  const params: unknown[] = [filters.workspaceId];

  if (filters.year && filters.month) {
    const range = monthRange(filters.year, filters.month);
    conditions.push('t.date >= ? AND t.date < ?');
    params.push(range.start, range.end);
  } else if (filters.year) {
    const range = yearRange(filters.year);
    conditions.push('t.date >= ? AND t.date < ?');
    params.push(range.start, range.end);
  }

  if (filters.categoryId) {
    conditions.push('t.category_id = ?');
    params.push(filters.categoryId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  return { where, params };
}

function getSummary(filters: Filters): DashboardSummary {
  const db = getDatabase();
  const { where, params } = buildDateFilter(filters);

  const result = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE WHEN is_income = 1 THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN is_income = 0 THEN amount ELSE 0 END), 0) as total_expenses,
      COUNT(*) as transaction_count,
      MIN(t.date) as period_start,
      MAX(t.date) as period_end
    FROM transactions t
    JOIN ledgers l ON t.ledger_id = l.id
    ${where}
  `
    )
    .get(...params) as {
    total_income: number;
    total_expenses: number;
    transaction_count: number;
    period_start: string | null;
    period_end: string | null;
  };

  return {
    totalIncome: result.total_income,
    totalExpenses: result.total_expenses,
    balance: result.total_income - result.total_expenses,
    transactionCount: result.transaction_count,
    periodStart: result.period_start || '',
    periodEnd: result.period_end || '',
  };
}

function getCategoryBreakdown(filters: Filters): CategoryBreakdown[] {
  const db = getDatabase();
  const { where, params } = buildDateFilter({ ...filters, categoryId: undefined });

  // Only get breakdown for expenses
  const expenseWhere = `${where} AND t.is_income = 0`;

  const results = db
    .prepare(
      `
    SELECT
      t.category_id,
      COALESCE(c.name, 'Uncategorized') as category_name,
      c.color as category_color,
      SUM(t.amount) as total,
      COUNT(*) as count
    FROM transactions t
    JOIN ledgers l ON t.ledger_id = l.id
    LEFT JOIN categories c ON t.category_id = c.id
    ${expenseWhere}
    GROUP BY t.category_id
    ORDER BY total DESC
  `
    )
    .all(...params) as Array<{
    category_id: number | null;
    category_name: string;
    category_color: string | null;
    total: number;
    count: number;
  }>;

  // Calculate percentages
  const totalExpenses = results.reduce((sum, r) => sum + r.total, 0);

  return results.map((r) => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    categoryColor: r.category_color,
    total: r.total,
    count: r.count,
    percentage: totalExpenses > 0 ? (r.total / totalExpenses) * 100 : 0,
  }));
}

function getMonthlyTrends(filters: Filters): MonthlyTrend[] {
  const db = getDatabase();

  // For trends, we only filter by year and workspace (show all months in that year)
  const conditions: string[] = ['l.workspace_id = ?'];
  const params: unknown[] = [filters.workspaceId];

  if (filters.year) {
    const range = yearRange(filters.year);
    conditions.push('t.date >= ? AND t.date < ?');
    params.push(range.start, range.end);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const results = db
    .prepare(
      `
    SELECT
      substr(t.date, 1, 7) as month,
      COALESCE(SUM(CASE WHEN is_income = 1 THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN is_income = 0 THEN amount ELSE 0 END), 0) as expenses
    FROM transactions t
    JOIN ledgers l ON t.ledger_id = l.id
    ${where}
    GROUP BY month
    ORDER BY month ASC
  `
    )
    .all(...params) as Array<{
    month: string;
    income: number;
    expenses: number;
  }>;

  return results.map((r) => ({
    month: r.month,
    income: r.income,
    expenses: r.expenses,
    balance: r.income - r.expenses,
  }));
}

function getRecentTransactions(filters: Filters, limit = 10): TransactionWithCategory[] {
  const db = getDatabase();
  const { where, params } = buildDateFilter(filters);

  const results = db
    .prepare(
      `
    SELECT
      t.id,
      t.ledger_id,
      t.date,
      t.description,
      t.amount,
      t.balance,
      t.category_id,
      t.is_income,
      t.raw_text,
      t.created_at,
      c.id as cat_id,
      c.name as cat_name,
      c.color as cat_color,
      c.icon as cat_icon,
      c.is_default as cat_is_default,
      c.created_at as cat_created_at
    FROM transactions t
    JOIN ledgers l ON t.ledger_id = l.id
    LEFT JOIN categories c ON t.category_id = c.id
    ${where}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ?
  `
    )
    .all(...params, limit) as Array<{
    id: number;
    ledger_id: number;
    date: string;
    description: string;
    amount: number;
    balance: number | null;
    category_id: number | null;
    is_income: number;
    raw_text: string | null;
    created_at: string;
    cat_id: number | null;
    cat_name: string | null;
    cat_color: string | null;
    cat_icon: string | null;
    cat_is_default: number | null;
    cat_created_at: string | null;
  }>;

  return results.map((r) => ({
    id: r.id,
    ledgerId: r.ledger_id,
    date: r.date,
    description: r.description,
    amount: r.amount,
    balance: r.balance,
    categoryId: r.category_id,
    isIncome: r.is_income === 1,
    rawText: r.raw_text,
    createdAt: r.created_at,
    category: r.cat_id
      ? {
          id: r.cat_id,
          name: r.cat_name!,
          color: r.cat_color,
          icon: r.cat_icon,
          isDefault: r.cat_is_default === 1,
          createdAt: r.cat_created_at!,
        }
      : null,
  }));
}

export function getAvailableYears(workspaceId: number): number[] {
  const db = getDatabase();
  const results = db
    .prepare(
      `
    SELECT DISTINCT substr(t.date, 1, 4) as year
    FROM transactions t
    JOIN ledgers l ON t.ledger_id = l.id
    WHERE l.workspace_id = ?
    ORDER BY year DESC
  `
    )
    .all(workspaceId) as Array<{ year: string }>;

  return results.map((r) => parseInt(r.year));
}
