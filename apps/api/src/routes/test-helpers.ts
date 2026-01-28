import express from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from '../middleware/errorHandler.js';

export const TEST_USER = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  locale: 'en' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
};

export function createTestApp(router: express.Router, path: string) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(path, router);
  app.use(errorHandler);
  return app;
}
