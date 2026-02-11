import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

vi.mock('../config.js', () => ({
  config: {
    smtp: null,
    resend: null,
  },
}));

import { config } from '../config.js';
import { sendEmail, sendPasswordResetEmail } from './emailService.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  (config as any).smtp = null;
  (config as any).resend = null;
});

describe('sendEmail', () => {
  describe('SMTP transport', () => {
    it('sends email when smtp config is present', async () => {
      (config as any).smtp = { host: 'smtp.test.com', port: 587, secure: false, user: 'user', pass: 'pass', from: 'noreply@test.com' };
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

      const result = await sendEmail('user@example.com', 'Test Subject', 'text body', '<p>html body</p>');

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'user@example.com',
        subject: 'Test Subject',
        text: 'text body',
        html: '<p>html body</p>',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns false on SMTP send failure', async () => {
      (config as any).smtp = { host: 'smtp.test.com', port: 587, secure: false, user: 'user', pass: 'pass', from: 'noreply@test.com' };
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await sendEmail('user@example.com', 'Test', 'text', '<p>html</p>');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send email:', 'Connection refused');
      consoleSpy.mockRestore();
    });

    it('SMTP takes priority over Resend when both configured', async () => {
      (config as any).smtp = { host: 'smtp.test.com', port: 587, secure: false, user: 'user', pass: 'pass', from: 'noreply@test.com' };
      (config as any).resend = { apiKey: 're_test', from: 'noreply@resend.com' };
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

      const result = await sendEmail('user@example.com', 'Test', 'text', '<p>html</p>');

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Resend transport', () => {
    it('sends email via Resend when resend config is present', async () => {
      (config as any).resend = { apiKey: 're_test', from: 'noreply@test.com' };
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'msg-1' }) });

      const result = await sendEmail('user@example.com', 'Test Subject', 'text body', '<p>html body</p>');

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
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('returns false on Resend API failure', async () => {
      (config as any).resend = { apiKey: 're_test', from: 'noreply@test.com' };
      mockFetch.mockResolvedValue({ ok: false, statusText: 'Bad Request', json: async () => ({ message: 'Invalid API key' }) });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await sendEmail('user@example.com', 'Test', 'text', '<p>html</p>');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send email via Resend:', 'Invalid API key');
      consoleSpy.mockRestore();
    });

    it('returns false on network error', async () => {
      (config as any).resend = { apiKey: 're_test', from: 'noreply@test.com' };
      mockFetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await sendEmail('user@example.com', 'Test', 'text', '<p>html</p>');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send email:', 'Network error');
      consoleSpy.mockRestore();
    });
  });

  describe('no transport configured', () => {
    it('returns false when neither SMTP nor Resend is configured', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await sendEmail('user@example.com', 'Test', 'text', '<p>html</p>');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('No email transport configured (SMTP_HOST or RESEND_API_KEY required), skipping email');
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('sendPasswordResetEmail', () => {
  it('sends email with correct subject and content', async () => {
    (config as any).resend = { apiKey: 're_test', from: 'noreply@test.com' };
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'msg-1' }) });

    const result = await sendPasswordResetEmail('user@example.com', 'https://app.com/reset?token=abc');

    expect(result).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe('noreply@test.com');
    expect(body.to).toBe('user@example.com');
    expect(body.subject).toBe('Reset your Compasso password');
    expect(body.text).toContain('https://app.com/reset?token=abc');
    expect(body.html).toContain('https://app.com/reset?token=abc');
  });

  it('returns false when no transport configured', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await sendPasswordResetEmail('test@example.com', 'https://app.com/reset?token=abc');

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
