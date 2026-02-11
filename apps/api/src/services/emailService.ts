import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter {
  if (!smtpTransport) {
    const smtp = config.smtp!;
    smtpTransport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }
  return smtpTransport;
}

async function sendViaSmtp(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const transport = getSmtpTransport();
  await transport.sendMail({ from: config.smtp!.from, to, subject, text, html });
  return true;
}

async function sendViaResend(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const resend = config.resend!;
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: resend.from, to, subject, text, html }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { message?: string };
    console.error('Failed to send email via Resend:', data.message || response.statusText);
    return false;
  }

  return true;
}

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  try {
    if (config.smtp) {
      return await sendViaSmtp(to, subject, text, html);
    }

    if (config.resend) {
      return await sendViaResend(to, subject, text, html);
    }

    console.warn('No email transport configured (SMTP_HOST or RESEND_API_KEY required), skipping email');
    return false;
  } catch (err) {
    console.error('Failed to send email:', err instanceof Error ? err.message : err);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  return sendEmail(
    to,
    'Reset your Compasso password',
    `You requested a password reset.\n\nClick here (valid 1 hour):\n${resetUrl}\n\nIgnore if you didn't request this.`,
    `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a> (valid 1 hour)</p><p>Ignore if you didn't request this.</p>`,
  );
}
