import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRateLimiter, forgotPasswordRateLimiter, resetPasswordRateLimiter } from './middleware/rateLimiter.js';

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (config.isProduction) {
        const selfOrigins = [
          `http://localhost:${config.port}`,
          `http://127.0.0.1:${config.port}`,
          `http://${config.host}:${config.port}`,
        ];
        if (selfOrigins.includes(origin)) return callback(null, true);
      }

      if (config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting on auth endpoints
  app.use('/api/auth/login', authRateLimiter);
  app.use('/api/auth/register', authRateLimiter);
  app.use('/api/auth/forgot-password', forgotPasswordRateLimiter);
  app.use('/api/auth/reset-password', resetPasswordRateLimiter);

  // API Routes
  registerRoutes(app);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
