import path from 'path';
import fs from 'fs';
import express from 'express';
import { config } from './config.js';
import { initDatabase } from './db/database.js';
import { seedDefaultCategories } from './db/seed.js';
import { cleanExpiredSessions } from './services/authService.js';
import { createApp } from './app.js';

// Initialize database
initDatabase(config.databasePath);
seedDefaultCategories();

const app = createApp();

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
