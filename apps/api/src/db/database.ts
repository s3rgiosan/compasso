import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export function initDatabase(dataDir: string): void {
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'compasso.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create schema
  createSchema();

  console.log(`Database initialized at ${dbPath}`);
}

function createSchema(): void {
  // Workspaces table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'briefcase',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      is_default INTEGER DEFAULT 0,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Category patterns table (bank-specific)
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      bank_id TEXT NOT NULL,
      pattern TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `);

  // Ledgers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledgers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      upload_date TEXT DEFAULT (datetime('now')),
      period_start TEXT,
      period_end TEXT,
      bank_id TEXT NOT NULL,
      file_hash TEXT UNIQUE,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE
    )
  `);

  // Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL,
      category_id INTEGER,
      is_income INTEGER NOT NULL,
      is_manual INTEGER DEFAULT 0,
      raw_text TEXT,
      recurring_pattern_id INTEGER REFERENCES recurring_patterns(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE,
      display_name TEXT,
      locale TEXT DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Recurring patterns table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      description_pattern TEXT NOT NULL,
      frequency TEXT NOT NULL,
      avg_amount REAL NOT NULL,
      occurrence_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Workspace members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('owner','editor','viewer')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(workspace_id, user_id)
    )
  `);

  // Workspace invitations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('editor','viewer')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
      created_at TEXT DEFAULT (datetime('now')),
      responded_at TEXT,
      UNIQUE(workspace_id, invited_user_id, status)
    )
  `);

  // Password reset tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_ledger ON transactions(ledger_id);
    CREATE INDEX IF NOT EXISTS idx_category_patterns_category ON category_patterns(category_id);
    CREATE INDEX IF NOT EXISTS idx_category_patterns_bank ON category_patterns(bank_id);
    CREATE INDEX IF NOT EXISTS idx_ledgers_bank ON ledgers(bank_id);
    CREATE INDEX IF NOT EXISTS idx_categories_workspace ON categories(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_ledgers_workspace ON ledgers(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_ledger_date ON transactions(ledger_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_ledger_category ON transactions(ledger_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_category_patterns_bank_category ON category_patterns(bank_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_recurring_patterns_workspace ON recurring_patterns(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_pattern_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_user ON workspace_invitations(invited_user_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
  `);

}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
