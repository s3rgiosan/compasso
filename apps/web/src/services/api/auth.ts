import { fetchApi } from './client';
import type { User } from '@compasso/shared';

export async function forgotPassword(email: string): Promise<void> {
  await fetchApi('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await fetchApi('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function updateProfile(data: {
  displayName?: string | null;
  email?: string;
  locale?: string;
}): Promise<User> {
  return fetchApi<User>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await fetchApi('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
