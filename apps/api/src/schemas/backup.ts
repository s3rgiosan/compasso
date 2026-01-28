import { z } from 'zod';

const backupPatternSchema = z.object({
  bankId: z.string(),
  pattern: z.string(),
  priority: z.number(),
});

const backupCategorySchema = z.object({
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  isDefault: z.boolean(),
  patterns: z.array(backupPatternSchema),
});

const backupTransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  balance: z.number().nullable(),
  categoryName: z.string().nullable(),
  isIncome: z.boolean(),
  isManual: z.boolean(),
  rawText: z.string().nullable(),
});

const backupLedgerSchema = z.object({
  filename: z.string(),
  uploadDate: z.string(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  bankId: z.string(),
  fileHash: z.string().nullable(),
  transactions: z.array(backupTransactionSchema),
});

const backupRecurringPatternSchema = z.object({
  descriptionPattern: z.string(),
  frequency: z.string(),
  avgAmount: z.number(),
  occurrenceCount: z.number(),
  isActive: z.boolean(),
});

export const workspaceBackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  workspace: z.object({
    name: z.string(),
    description: z.string().nullable(),
    color: z.string(),
    icon: z.string(),
  }),
  categories: z.array(backupCategorySchema),
  ledgers: z.array(backupLedgerSchema),
  recurringPatterns: z.array(backupRecurringPatternSchema),
});
