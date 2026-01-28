import { fetchApi, ApiError, API_BASE } from './client';
import type {
  UploadResponse,
  BankId,
  PaginatedResponse,
  ApiResponse,
} from '@compasso/shared';

export async function uploadPDF(
  file: File,
  workspaceId: number,
  bankId: BankId = 'novo_banco'
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/upload?bank=${bankId}&workspaceId=${workspaceId}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
  } catch {
    throw new ApiError('Unable to connect to the server', 0);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new ApiError(`Server error (${response.status})`, response.status);
  }

  const data: ApiResponse<UploadResponse> = await response.json();

  if (!data.success) {
    throw new ApiError(
      data.error || 'Failed to upload file',
      response.status,
      data.code
    );
  }

  return data.data as UploadResponse;
}

export async function getSupportedBanks(): Promise<
  Array<{ id: string; name: string; country: string; currency: string }>
> {
  return fetchApi('/upload/banks');
}

export interface LedgerItem {
  id: number;
  filename: string;
  uploadDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  bankId: string;
  transactionCount: number;
}

export async function getLedgers(
  workspaceId: number,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<PaginatedResponse<LedgerItem>> {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId.toString());
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  return fetchApi(`/upload/ledgers?${params.toString()}`);
}

export async function deleteLedger(id: number): Promise<void> {
  await fetchApi(`/upload/ledgers/${id}`, {
    method: 'DELETE',
  });
}
