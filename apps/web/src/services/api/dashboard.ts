import { fetchApi } from './client';
import type { DashboardData } from '@compasso/shared';

export async function getDashboard(
  workspaceId: number,
  filters?: {
    year?: number;
    month?: number;
    categoryId?: number;
  }
): Promise<DashboardData> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  if (filters?.year) params.set('year', filters.year.toString());
  if (filters?.month) params.set('month', filters.month.toString());
  if (filters?.categoryId) params.set('categoryId', filters.categoryId.toString());

  return fetchApi<DashboardData>(`/dashboard?${params.toString()}`);
}

export async function getAvailableYears(workspaceId: number): Promise<number[]> {
  return fetchApi<number[]>(`/dashboard/years?workspaceId=${workspaceId}`);
}
