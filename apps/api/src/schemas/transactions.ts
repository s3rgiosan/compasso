import { z } from 'zod';
import { workspaceIdField } from './common.js';

const transactionItem = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  balance: z.number().optional(),
  isIncome: z.boolean(),
  categoryId: z.number().int().positive().nullish(),
  rawText: z.string().optional(),
});

export const confirmTransactionsSchema = z.object({
  ledgerId: z.number().int().positive(),
  transactions: z.array(transactionItem).min(1),
});

export const updateTransactionSchema = z.object({
  categoryId: z.number().int().positive().nullable(),
  workspaceId: workspaceIdField,
});
