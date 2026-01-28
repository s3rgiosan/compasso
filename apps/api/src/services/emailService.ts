import { config } from '../config.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!config.resend) {
    console.warn('Resend not configured (RESEND_API_KEY missing), skipping email');
    return false;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resend.from,
        to,
        subject: 'Reset your Compasso password',
        text: `You requested a password reset.\n\nClick here (valid 1 hour):\n${resetUrl}\n\nIgnore if you didn't request this.`,
        html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a> (valid 1 hour)</p><p>Ignore if you didn't request this.</p>`,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      console.error('Failed to send reset email:', data.message || response.statusText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send reset email:', err instanceof Error ? err.message : err);
    return false;
  }
}
