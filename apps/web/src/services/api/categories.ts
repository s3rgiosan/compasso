import { fetchApi } from './client';
import type {
  Category,
  CategoryWithPatterns,
  PaginatedResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  AddPatternRequest,
} from '@compasso/shared';

export async function getCategories(
  workspaceId: number,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<PaginatedResponse<Category>> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  return fetchApi<PaginatedResponse<Category>>(`/categories?${params.toString()}`);
}

export async function checkPatternExists(
  workspaceId: number,
  bankId: string,
  pattern: string
): Promise<{ exists: boolean; categoryName?: string }> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  params.set('bankId', bankId);
  params.set('pattern', pattern);
  return fetchApi(`/categories/patterns/exists?${params.toString()}`);
}

export async function getCategory(
  id: number,
  workspaceId: number,
  bankId?: string
): Promise<CategoryWithPatterns> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  if (bankId) params.set('bank', bankId);
  return fetchApi<CategoryWithPatterns>(`/categories/${id}?${params.toString()}`);
}

export async function createCategory(
  data: CreateCategoryRequest
): Promise<Category> {
  return fetchApi<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: number,
  workspaceId: number,
  data: UpdateCategoryRequest
): Promise<void> {
  await fetchApi(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, workspaceId }),
  });
}

export async function deleteCategory(id: number, workspaceId: number): Promise<void> {
  await fetchApi(`/categories/${id}?workspaceId=${workspaceId}`, {
    method: 'DELETE',
  });
}

export async function addCategoryPattern(
  categoryId: number,
  workspaceId: number,
  data: AddPatternRequest
): Promise<{
  id: number;
  categoryId: number;
  bankId: string;
  pattern: string;
  priority: number;
  recategorized?: number;
}> {
  return fetchApi(`/categories/${categoryId}/patterns`, {
    method: 'POST',
    body: JSON.stringify({ ...data, workspaceId }),
  });
}

export async function deleteCategoryPattern(
  categoryId: number,
  patternId: number,
  workspaceId: number
): Promise<void> {
  await fetchApi(`/categories/${categoryId}/patterns/${patternId}?workspaceId=${workspaceId}`, {
    method: 'DELETE',
  });
}

// Quick Pattern Creation (for upload flow)
export interface QuickPatternRequest {
  pattern: string;
  bankId: string;
  workspaceId: number;
  transactionIndices?: number[];
}

export interface QuickPatternResponse {
  patternId: number;
  appliedCount: number;
}

export async function createQuickPattern(
  categoryId: number,
  data: QuickPatternRequest
): Promise<QuickPatternResponse> {
  return fetchApi<QuickPatternResponse>(`/categories/${categoryId}/patterns/quick`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
