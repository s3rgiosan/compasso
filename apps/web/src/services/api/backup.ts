import { ApiError, API_BASE } from './client';
import type { ApiResponse } from '@compasso/shared';

export interface ImportResult {
  categoriesImported: number;
  categoriesSkipped: number;
  patternsImported: number;
  patternsSkipped: number;
  ledgersImported: number;
  ledgersSkipped: number;
  transactionsImported: number;
  recurringPatternsImported: number;
  recurringPatternsSkipped: number;
}

export async function exportWorkspaceBackup(workspaceId: number): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/backup/export?workspaceId=${workspaceId}`, {
      credentials: 'include',
    });
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

  // Extract filename from Content-Disposition header
  const disposition = response.headers.get('Content-Disposition');
  let filename = 'compasso-backup.json';
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  // Trigger download via hidden anchor
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importWorkspaceBackup(workspaceId: number, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/backup/import?workspaceId=${workspaceId}`, {
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

  const data: ApiResponse<ImportResult> = await response.json();

  if (!data.success) {
    throw new ApiError(
      data.error || 'Failed to import backup',
      response.status,
      data.code
    );
  }

  return data.data as ImportResult;
}
