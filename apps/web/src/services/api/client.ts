import type { ApiResponse } from '@compasso/shared';
import { notifySessionExpired } from '../authEvents';

export const API_BASE = '/api';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/**
 * Centralized fetch wrapper. Handles JSON parsing, error extraction,
 * and session expiry detection (emits an event so AuthContext can redirect
 * to login). Auth endpoints are excluded from expiry handling to avoid
 * redirect loops during login/register.
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch {
    throw new ApiError('Unable to connect to the server', 0);
  }

  // Check content-type before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(`Server error (${response.status})`, response.status);
    }
    throw new ApiError('Unexpected response format', response.status);
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    // Handle session expiry
    if (
      response.status === 401 &&
      (data.code === 'SESSION_EXPIRED' || data.code === 'AUTH_REQUIRED') &&
      !AUTH_ENDPOINTS.some((ep) => endpoint.startsWith(ep))
    ) {
      notifySessionExpired();
    }

    throw new ApiError(
      data.error || 'An error occurred',
      response.status,
      data.code
    );
  }

  return data.data as T;
}
