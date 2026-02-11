import path from 'path';

interface ResendConfig {
  apiKey: string;
  from: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  nodeEnv: string;
  isProduction: boolean;
  allowedOrigins: string[];
  smtp: SmtpConfig | null;
  resend: ResendConfig | null;
  demoMode: boolean;
}

function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.PORT) || 5181;
  const host = process.env.HOST || '127.0.0.1';
  const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5180',
    'http://127.0.0.1:5180',
  ];

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtp: SmtpConfig | null = smtpHost
    ? {
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@compasso.app',
      }
    : null;

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend: ResendConfig | null = resendApiKey
    ? { apiKey: resendApiKey, from: process.env.EMAIL_FROM || 'noreply@compasso.app' }
    : null;

  const demoMode = process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1';

  return { port, host, databasePath, nodeEnv, isProduction: nodeEnv === 'production', allowedOrigins, smtp, resend, demoMode };
}

export const config = loadConfig();
