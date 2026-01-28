import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const detectRecurringSchema = z.object({
  workspaceId: workspaceIdField,
});

export const togglePatternSchema = z.object({
  isActive: z.boolean(),
});

export const updatePatternSchema = z.object({
  descriptionPattern: z.string().min(1).max(500).optional(),
  frequency: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  avgAmount: z.number().positive().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
});
