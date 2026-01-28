import { fetchApi, ApiError, API_BASE } from './client';
import type {
  TransactionWithCategory,
  PaginatedResponse,
  ConfirmTransactionsRequest,
} from '@compasso/shared';

export async function getTransactions(
  workspaceId: number,
  filters?: {
    year?: number;
    month?: number;
    categoryId?: number;
    isIncome?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<PaginatedResponse<TransactionWithCategory>> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  if (filters?.year) params.set('year', filters.year.toString());
  if (filters?.month) params.set('month', filters.month.toString());
  if (filters?.categoryId) params.set('categoryId', filters.categoryId.toString());
  if (filters?.isIncome !== undefined) params.set('isIncome', filters.isIncome.toString());
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.offset) params.set('offset', filters.offset.toString());

  return fetchApi<PaginatedResponse<TransactionWithCategory>>(
    `/transactions?${params.toString()}`
  );
}

export async function updateTransaction(
  id: number,
  workspaceId: number,
  data: { categoryId: number | null }
): Promise<void> {
  await fetchApi(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, workspaceId }),
  });
}

export async function deleteTransaction(id: number, workspaceId: number): Promise<void> {
  await fetchApi(`/transactions/${id}?workspaceId=${workspaceId}`, {
    method: 'DELETE',
  });
}

export async function confirmTransactions(
  request: ConfirmTransactionsRequest
): Promise<{ count: number }> {
  return fetchApi<{ count: number }>('/transactions/confirm', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function exportTransactionsCsv(
  workspaceId: number,
  filters?: { year?: number; month?: number; categoryId?: number; isIncome?: boolean; search?: string }
): Promise<void> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  if (filters?.year) params.set('year', filters.year.toString());
  if (filters?.month) params.set('month', filters.month.toString());
  if (filters?.categoryId) params.set('categoryId', filters.categoryId.toString());
  if (filters?.isIncome !== undefined) params.set('isIncome', filters.isIncome.toString());
  if (filters?.search) params.set('search', filters.search);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/transactions/export?${params}`, { credentials: 'include' });
  } catch {
    throw new ApiError('Unable to connect to the server', 0);
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      throw new ApiError(data.error || 'Export failed', response.status, data.code);
    }
    throw new ApiError(`Export failed (${response.status})`, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  let filename = 'compasso-transactions.csv';
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
