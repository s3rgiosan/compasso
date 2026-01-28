import path from 'path';

interface ResendConfig {
  apiKey: string;
  from: string;
}

interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  nodeEnv: string;
  isProduction: boolean;
  allowedOrigins: string[];
  resend: ResendConfig | null;
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

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend: ResendConfig | null = resendApiKey
    ? { apiKey: resendApiKey, from: process.env.EMAIL_FROM || 'noreply@compasso.app' }
    : null;

  return { port, host, databasePath, nodeEnv, isProduction: nodeEnv === 'production', allowedOrigins, resend };
}

export const config = loadConfig();
