import { getDatabase } from './database.js';
import { seedCategoriesForWorkspace } from './seed.js';
import { hashPassword } from '../services/authService.js';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'demo';
const DEMO_EMAIL = 'demo@demo.com';
const DEMO_DISPLAY_NAME = 'Demo User';
const DEMO_LOCALE = 'en';

interface TransactionTemplate {
  categoryName: string;
  descriptions: string[];
  amountRange: [number, number];
  isIncome: boolean;
  frequency: number; // per month
}

const TRANSACTION_TEMPLATES: TransactionTemplate[] = [
  // Expenses (~85%)
  { categoryName: 'Groceries', descriptions: ['Whole Foods', 'Trader Joe\'s', 'Costco', 'Kroger', 'Walmart', 'Target'], amountRange: [15, 150], isIncome: false, frequency: 8 },
  { categoryName: 'Fuel', descriptions: ['Shell', 'Chevron', 'ExxonMobil', 'BP Gas Station'], amountRange: [30, 80], isIncome: false, frequency: 3 },
  { categoryName: 'Dining', descriptions: ['Chipotle', 'Olive Garden', 'McDonald\'s', 'Pizza Hut', 'Starbucks', 'Panera Bread'], amountRange: [8, 45], isIncome: false, frequency: 6 },
  { categoryName: 'Entertainment', descriptions: ['Netflix', 'Spotify', 'AMC Theatres', 'Steam', 'HBO Max'], amountRange: [5, 30], isIncome: false, frequency: 3 },
  { categoryName: 'Shopping', descriptions: ['Amazon', 'Best Buy', 'Target', 'Nordstrom', 'Macy\'s', 'IKEA'], amountRange: [15, 120], isIncome: false, frequency: 3 },
  { categoryName: 'Utilities', descriptions: ['Con Edison Electric', 'Water & Sewer', 'Comcast Internet', 'AT&T Wireless', 'Verizon'], amountRange: [25, 90], isIncome: false, frequency: 3 },
  { categoryName: 'Housing', descriptions: ['Monthly Rent', 'HOA Dues'], amountRange: [600, 900], isIncome: false, frequency: 1 },
  { categoryName: 'Health', descriptions: ['CVS Pharmacy', 'Walgreens', 'Dr. Smith DDS', 'LabCorp'], amountRange: [10, 80], isIncome: false, frequency: 2 },
  { categoryName: 'Fitness', descriptions: ['Planet Fitness', 'LA Fitness'], amountRange: [30, 50], isIncome: false, frequency: 1 },
  { categoryName: 'Insurance', descriptions: ['Geico Auto Insurance', 'Blue Cross Health'], amountRange: [40, 120], isIncome: false, frequency: 1 },
  { categoryName: 'Fees', descriptions: ['Monthly Maintenance Fee', 'Debit Card Fee', 'ATM Surcharge'], amountRange: [2, 15], isIncome: false, frequency: 1 },
  { categoryName: 'Cash', descriptions: ['ATM Withdrawal', 'Cash Back'], amountRange: [20, 200], isIncome: false, frequency: 2 },
  { categoryName: 'Transfers', descriptions: ['Venmo Transfer', 'Zelle Payment'], amountRange: [10, 100], isIncome: false, frequency: 2 },
  { categoryName: 'Other', descriptions: ['Online Purchase', 'Direct Debit', 'Service Payment'], amountRange: [5, 50], isIncome: false, frequency: 2 },

  // Income (~15%)
  { categoryName: 'Income', descriptions: ['Payroll - Acme Corp', 'Direct Deposit - Salary'], amountRange: [1500, 2500], isIncome: true, frequency: 1 },
  { categoryName: 'Income', descriptions: ['Tax Refund - IRS', 'Savings Interest', 'Freelance Payment'], amountRange: [50, 500], isIncome: true, frequency: 1 },
];

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(year: number, month: number): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function seedDemoData(): void {
  const db = getDatabase();

  // Idempotent: skip if demo user already exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(DEMO_USERNAME) as { id: number } | undefined;
  if (existingUser) {
    console.log('Demo user already exists, skipping demo seed.');
    return;
  }

  console.log('Seeding demo data...');

  const passwordHash = hashPassword(DEMO_PASSWORD);

  const seed = db.transaction(() => {
    // 1. Create demo user (bypass registerUser to allow short password)
    const userResult = db.prepare(
      'INSERT INTO users (username, password_hash, email, display_name, locale) VALUES (?, ?, ?, ?, ?)'
    ).run(DEMO_USERNAME, passwordHash, DEMO_EMAIL, DEMO_DISPLAY_NAME, DEMO_LOCALE);
    const userId = Number(userResult.lastInsertRowid);

    // 2. Create demo workspace
    const workspaceResult = db.prepare(
      'INSERT INTO workspaces (name, description, color, icon, is_default) VALUES (?, ?, ?, ?, 0)'
    ).run('Demo', 'Demo workspace with sample data', '#f59e0b', 'play-circle');
    const workspaceId = Number(workspaceResult.lastInsertRowid);

    // 3. Add user as workspace owner
    db.prepare(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
    ).run(workspaceId, userId, 'owner');

    // 4. Seed categories
    seedCategoriesForWorkspace(workspaceId, DEMO_LOCALE);

    // 5. Build category name -> id map
    const categories = db.prepare(
      'SELECT id, name FROM categories WHERE workspace_id = ?'
    ).all(workspaceId) as Array<{ id: number; name: string }>;
    const categoryMap: Record<string, number> = {};
    for (const cat of categories) {
      categoryMap[cat.name] = cat.id;
    }

    // 6. Create demo ledger (null file_hash to avoid UNIQUE constraint issues)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const periodStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
    const periodEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

    const ledgerResult = db.prepare(
      'INSERT INTO ledgers (filename, bank_id, file_hash, workspace_id, period_start, period_end) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('demo-data.pdf', 'novo_banco', null, workspaceId, periodStart, periodEnd);
    const ledgerId = Number(ledgerResult.lastInsertRowid);

    // 7. Generate transactions across 6 months
    const insertTx = db.prepare(`
      INSERT INTO transactions (ledger_id, date, description, amount, balance, category_id, is_income)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transactions: Array<{ date: string; description: string; amount: number; categoryId: number | null; isIncome: boolean }> = [];

    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const date = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + monthOffset, 1);
      const year = date.getFullYear();
      const month = date.getMonth();

      for (const template of TRANSACTION_TEMPLATES) {
        const categoryId = categoryMap[template.categoryName] ?? null;
        for (let i = 0; i < template.frequency; i++) {
          transactions.push({
            date: randomDate(year, month),
            description: randomElement(template.descriptions),
            amount: randomInRange(...template.amountRange),
            categoryId,
            isIncome: template.isIncome,
          });
        }
      }
    }

    // Sort by date for running balance
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    // Running balance: amounts are always positive, direction from isIncome
    let balance = 3500;
    for (const tx of transactions) {
      balance += tx.isIncome ? tx.amount : -tx.amount;
      balance = Math.round(balance * 100) / 100;
      insertTx.run(ledgerId, tx.date, tx.description, tx.amount, balance, tx.categoryId, tx.isIncome ? 1 : 0);
    }

    console.log(`Demo seed complete: ${transactions.length} transactions created for user "${DEMO_USERNAME}".`);
  });

  seed.immediate();
}
