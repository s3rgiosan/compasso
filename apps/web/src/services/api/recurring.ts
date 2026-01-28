import { fetchApi } from './client';
import type { TransactionWithCategory } from '@compasso/shared';

export interface RecurringPatternResponse {
  id: number;
  descriptionPattern: string;
  frequency: string;
  avgAmount: number;
  occurrenceCount: number;
  isActive: boolean;
  createdAt: string;
}

export async function getRecurringPatterns(workspaceId: number): Promise<RecurringPatternResponse[]> {
  return fetchApi<RecurringPatternResponse[]>(`/recurring?workspaceId=${workspaceId}`);
}

export async function detectRecurringPatterns(workspaceId: number): Promise<{
  detected: number;
  totalPatterns: number;
}> {
  return fetchApi('/recurring/detect', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  });
}

export async function toggleRecurringPattern(patternId: number, workspaceId: number, isActive: boolean): Promise<void> {
  await fetchApi(`/recurring/${patternId}?workspaceId=${workspaceId}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  });
}

export async function deleteRecurringPattern(patternId: number, workspaceId: number): Promise<void> {
  await fetchApi(`/recurring/${patternId}?workspaceId=${workspaceId}`, {
    method: 'DELETE',
  });
}

export async function getPatternTransactions(
  patternId: number,
  workspaceId: number
): Promise<TransactionWithCategory[]> {
  return fetchApi<TransactionWithCategory[]>(
    `/recurring/${patternId}/transactions?workspaceId=${workspaceId}`
  );
}

export async function updateRecurringPattern(
  patternId: number,
  workspaceId: number,
  data: {
    descriptionPattern?: string;
    frequency?: string;
    avgAmount?: number;
    isActive?: boolean;
  }
): Promise<void> {
  await fetchApi(`/recurring/${patternId}?workspaceId=${workspaceId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
