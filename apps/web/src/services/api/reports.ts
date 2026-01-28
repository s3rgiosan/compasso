import { fetchApi } from './client';

export interface YearlySummary {
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

export interface CategoryTrend {
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

export async function getReportYears(workspaceId: number): Promise<number[]> {
  return fetchApi<number[]>(`/reports/years?workspaceId=${workspaceId}`);
}

export async function getYearlySummary(workspaceId: number, year: number): Promise<YearlySummary> {
  return fetchApi<YearlySummary>(`/reports/yearly?workspaceId=${workspaceId}&year=${year}`);
}

export async function getCategoryTrends(workspaceId: number, months?: number): Promise<CategoryTrend[]> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  if (months) params.set('months', months.toString());
  return fetchApi<CategoryTrend[]>(`/reports/category-trends?${params.toString()}`);
}
