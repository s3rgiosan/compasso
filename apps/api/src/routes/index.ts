import type { Express } from 'express';
import auth from './auth.js';
import workspaces from './workspaces.js';
import dashboard from './dashboard.js';
import transactions from './transactions.js';
import categories from './categories.js';
import upload from './upload.js';
import recurring from './recurring.js';
import reports from './reports.js';
import invitations from './invitations.js';
import backup from './backup.js';

export function registerRoutes(app: Express) {
  app.use('/api/auth', auth);
  app.use('/api/workspaces', workspaces);
  app.use('/api/dashboard', dashboard);
  app.use('/api/transactions', transactions);
  app.use('/api/categories', categories);
  app.use('/api/upload', upload);
  app.use('/api/recurring', recurring);
  app.use('/api/reports', reports);
  app.use('/api/workspaces', invitations);
  app.use('/api/invitations', invitations);
  app.use('/api/backup', backup);
}
