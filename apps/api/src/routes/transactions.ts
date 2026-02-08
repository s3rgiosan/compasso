import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../schemas/common.js';
import { confirmTransactionsSchema, updateTransactionSchema } from '../schemas/transactions.js';
import { requireQueryInt, optionalQueryInt, optionalQueryString } from '../utils/queryHelpers.js';
import {
  listTransactions,
  exportTransactions,
  confirmTransactions,
  updateTransactionCategory,
  deleteTransaction,
} from '../services/transactionService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';
import { getLedgerWorkspaceId } from '../services/uploadService.js';

const router = Router();

router.use(authMiddleware);

// GET /api/transactions
router.get('/', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const result = listTransactions({
    workspaceId,
    year: optionalQueryInt(req, 'year'),
    month: optionalQueryInt(req, 'month'),
    categoryId: req.query.categoryId === 'none' ? 'none' : optionalQueryInt(req, 'categoryId'),
    isIncome: req.query.isIncome !== undefined
      ? req.query.isIncome === 'true'
      : undefined,
    search: optionalQueryString(req, 'search'),
    limit: optionalQueryInt(req, 'limit'),
    offset: optionalQueryInt(req, 'offset'),
  });

  res.json({ success: true, data: result });
}));

// POST /api/transactions/confirm
router.post('/confirm', validate({ body: confirmTransactionsSchema }), asyncHandler((req, res) => {
  const { ledgerId, transactions } = req.body;
  const workspaceId = getLedgerWorkspaceId(ledgerId);
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const count = confirmTransactions(ledgerId, transactions);
  res.json({ success: true, data: { count } });
}));

// GET /api/transactions/export
router.get('/export', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const transactions = exportTransactions({
    workspaceId,
    year: optionalQueryInt(req, 'year'),
    month: optionalQueryInt(req, 'month'),
    categoryId: req.query.categoryId === 'none' ? 'none' : optionalQueryInt(req, 'categoryId'),
    isIncome: req.query.isIncome !== undefined ? req.query.isIncome === 'true' : undefined,
    search: optionalQueryString(req, 'search'),
  });

  const BOM = '\uFEFF';
  const header = 'Date,Description,Type,Amount,Category,Balance';
  const rows = transactions.map((tx) => {
    const signedAmount = tx.isIncome ? tx.amount : -tx.amount;
    return [
      tx.date,
      escapeCsvField(tx.description),
      tx.isIncome ? 'Income' : 'Expense',
      signedAmount.toFixed(2),
      escapeCsvField(tx.categoryName),
      tx.balance !== null ? tx.balance.toFixed(2) : '',
    ].join(',');
  });

  const csv = BOM + [header, ...rows].join('\r\n') + '\r\n';
  const filename = `compasso-transactions-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));

// PUT /api/transactions/:id
router.put('/:id', validate({ body: updateTransactionSchema, params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { categoryId, workspaceId } = req.body;
  requireWorkspaceMembership(workspaceId, req.user!.id);
  updateTransactionCategory(id, categoryId, workspaceId);
  res.json({ success: true });
}));

// DELETE /api/transactions/:id
// Query param: ?workspaceId=1 (required)
router.delete('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  deleteTransaction(id, req.user!.id);
  res.json({ success: true });
}));

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default router;
