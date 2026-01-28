import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    resend: null,
  },
}));

import { config } from '../config.js';
import { sendPasswordResetEmail } from './emailService.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendPasswordResetEmail', () => {
  it('returns false when resend is not configured', async () => {
    (config as any).resend = null;

    const result = await sendPasswordResetEmail('test@example.com', 'https://app.com/reset?token=abc');

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends email and returns true when resend is configured', async () => {
    (config as any).resend = { apiKey: 're_test', from: 'noreply@test.com' };
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'msg-1' }) });

    const result = await sendPasswordResetEmail('user@example.com', 'https://app.com/reset?token=abc');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer re_test',
        }),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe('noreply@test.com');
    expect(body.to).toBe('user@example.com');
    expect(body.subject).toBe('Reset your Compasso password');
  });

  it('returns false and logs error on send failure', async () => {
    (config as any).resend = { apiKey: 're_test', from: 'noreply@test.com' };
    mockFetch.mockResolvedValue({ ok: false, statusText: 'Bad Request', json: async () => ({ message: 'Invalid API key' }) });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await sendPasswordResetEmail('user@example.com', 'https://app.com/reset?token=abc');

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to send reset email:', 'Invalid API key');
    consoleSpy.mockRestore();
  });

  it('returns false on network error', async () => {
    (config as any).resend = { apiKey: 're_test', from: 'noreply@test.com' };
    mockFetch.mockRejectedValue(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await sendPasswordResetEmail('user@example.com', 'https://app.com/reset?token=abc');

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to send reset email:', 'Network error');
    consoleSpy.mockRestore();
  });
});
