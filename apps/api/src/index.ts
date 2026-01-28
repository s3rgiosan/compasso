import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { initDatabase } from './db/database.js';
import { seedDefaultCategories } from './db/seed.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRateLimiter, forgotPasswordRateLimiter, resetPasswordRateLimiter } from './middleware/rateLimiter.js';
import { cleanExpiredSessions } from './services/authService.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // In production, allow same-origin requests (frontend served from same host)
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

// Initialize database
initDatabase(config.databasePath);
seedDefaultCategories();

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

// Serve static frontend in production
if (config.isProduction) {
  // Try multiple paths for the frontend dist
  const possiblePaths = [
    path.join(process.cwd(), 'apps', 'web', 'dist'),
    path.join(process.cwd(), '..', 'web', 'dist'),
    path.join(process.cwd(), 'public'),
  ];

  let staticPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      staticPath = p;
      break;
    }
  }

  if (staticPath) {
    console.log(`Serving static frontend from: ${staticPath}`);
    app.use(express.static(staticPath));

    // SPA fallback - serve index.html for non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(staticPath!, 'index.html'));
    });
  } else {
    console.warn('No static frontend found, API-only mode');
  }
}

// Error handling middleware
app.use(errorHandler);

// Clean expired sessions on startup and every 24 hours
const cleaned = cleanExpiredSessions();
if (cleaned > 0) {
  console.log(`Cleaned ${cleaned} expired sessions`);
}
setInterval(() => {
  const count = cleanExpiredSessions();
  if (count > 0) {
    console.log(`Cleaned ${count} expired sessions`);
  }
}, 24 * 60 * 60 * 1000);

app.listen(config.port, config.host, () => {
  console.log(`Compasso API running on http://${config.host}:${config.port}`);
  console.log(`Environment: ${config.isProduction ? 'production' : 'development'}`);
  console.log(`Database path: ${config.databasePath}`);
});
