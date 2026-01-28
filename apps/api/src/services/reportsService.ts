import { getDatabase } from '../db/database.js';
import { yearRange } from '../utils/dateHelpers.js';

interface YearlySummary {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  transactionCount: number;
  categoryBreakdown: Array<{
    categoryId: number | null;
    categoryName: string;
    categoryColor: string | null;
    total: number;
    count: number;
    percentage: number;
  }>;
  monthlyBreakdown: Array<{
    month: string;
    income: number;
    expenses: number;
    netSavings: number;
  }>;
}

interface CategoryTrend {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string | null;
  monthlyData: Array<{
    month: string;
    total: number;
  }>;
  trend: 'up' | 'down' | 'stable';
  avgMonthly: number;
}

/**
 * Get yearly summary for a workspace
 */
export function getYearlySummary(workspaceId: number, year: number): YearlySummary {
  const db = getDatabase();

  // Get yearly totals
  const yearlyTotals = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN t.is_income = 1 THEN t.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN t.is_income = 0 THEN t.amount ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      WHERE l.workspace_id = ? AND t.date >= ? AND t.date < ?
    `
    )
    .get(workspaceId, yearRange(year).start, yearRange(year).end) as {
    total_income: number | null;
    total_expenses: number | null;
    transaction_count: number;
  };

  const totalIncome = yearlyTotals.total_income || 0;
  const totalExpenses = yearlyTotals.total_expenses || 0;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Get category breakdown (expenses only)
  const categoryBreakdown = db
    .prepare(
      `
      SELECT
        c.id as category_id,
        COALESCE(c.name, 'Uncategorized') as category_name,
        c.color as category_color,
        SUM(t.amount) as total,
        COUNT(*) as count
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE l.workspace_id = ? AND t.date >= ? AND t.date < ? AND t.is_income = 0
      GROUP BY t.category_id
      ORDER BY total DESC
    `
    )
    .all(workspaceId, yearRange(year).start, yearRange(year).end) as Array<{
    category_id: number | null;
    category_name: string;
    category_color: string | null;
    total: number;
    count: number;
  }>;

  const totalExpensesForPercentage = categoryBreakdown.reduce((sum, c) => sum + c.total, 0);

  // Get monthly breakdown
  const monthlyBreakdown = db
    .prepare(
      `
      SELECT
        substr(t.date, 1, 7) as month,
        SUM(CASE WHEN t.is_income = 1 THEN t.amount ELSE 0 END) as income,
        SUM(CASE WHEN t.is_income = 0 THEN t.amount ELSE 0 END) as expenses
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      WHERE l.workspace_id = ? AND t.date >= ? AND t.date < ?
      GROUP BY substr(t.date, 1, 7)
      ORDER BY month ASC
    `
    )
    .all(workspaceId, yearRange(year).start, yearRange(year).end) as Array<{
    month: string;
    income: number;
    expenses: number;
  }>;

  return {
    year,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    transactionCount: yearlyTotals.transaction_count,
    categoryBreakdown: categoryBreakdown.map((c) => ({
      categoryId: c.category_id,
      categoryName: c.category_name,
      categoryColor: c.category_color,
      total: c.total,
      count: c.count,
      percentage:
        totalExpensesForPercentage > 0 ? (c.total / totalExpensesForPercentage) * 100 : 0,
    })),
    monthlyBreakdown: monthlyBreakdown.map((m) => ({
      month: m.month,
      income: m.income,
      expenses: m.expenses,
      netSavings: m.income - m.expenses,
    })),
  };
}

/**
 * Get category spending trends over time
 */
export function getCategoryTrends(
  workspaceId: number,
  months: number = 12
): CategoryTrend[] {
  const db = getDatabase();

  // Get monthly spending by category for the last N months
  const monthlyData = db
    .prepare(
      `
      SELECT
        t.category_id,
        COALESCE(c.name, 'Uncategorized') as category_name,
        c.color as category_color,
        substr(t.date, 1, 7) as month,
        SUM(t.amount) as total
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE l.workspace_id = ?
        AND t.is_income = 0
        AND t.date >= date('now', '-' || ? || ' months')
      GROUP BY t.category_id, substr(t.date, 1, 7)
      ORDER BY category_name, month
    `
    )
    .all(workspaceId, months) as Array<{
    category_id: number | null;
    category_name: string;
    category_color: string | null;
    month: string;
    total: number;
  }>;

  // Group by category
  const categoryMap = new Map<
    string,
    {
      categoryId: number | null;
      categoryName: string;
      categoryColor: string | null;
      monthlyData: Array<{ month: string; total: number }>;
    }
  >();

  for (const row of monthlyData) {
    const key = row.category_name;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        categoryId: row.category_id,
        categoryName: row.category_name,
        categoryColor: row.category_color,
        monthlyData: [],
      });
    }
    categoryMap.get(key)!.monthlyData.push({
      month: row.month,
      total: row.total,
    });
  }

  // Calculate trends
  const trends: CategoryTrend[] = [];

  for (const [, category] of categoryMap) {
    const data = category.monthlyData;
    const avgMonthly =
      data.length > 0
        ? data.reduce((sum, m) => sum + m.total, 0) / data.length
        : 0;

    // Calculate trend direction (compare first half to second half)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (data.length >= 2) {
      const midpoint = Math.floor(data.length / 2);
      const firstHalfAvg =
        data.slice(0, midpoint).reduce((sum, m) => sum + m.total, 0) / midpoint;
      const secondHalfAvg =
        data.slice(midpoint).reduce((sum, m) => sum + m.total, 0) /
        (data.length - midpoint);

      const percentChange =
        firstHalfAvg > 0
          ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
          : 0;

      if (percentChange > 10) {
        trend = 'up';
      } else if (percentChange < -10) {
        trend = 'down';
      }
    }

    trends.push({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      categoryColor: category.categoryColor,
      monthlyData: data,
      trend,
      avgMonthly,
    });
  }

  // Sort by average monthly spending (highest first)
  trends.sort((a, b) => b.avgMonthly - a.avgMonthly);

  return trends;
}

/**
 * Get available years for reports
 */
export function getAvailableYearsForReports(workspaceId: number): number[] {
  const db = getDatabase();

  const years = db
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

  return years.map((y) => parseInt(y.year));
}
