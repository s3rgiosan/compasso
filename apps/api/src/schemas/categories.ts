import { z } from 'zod';
import { workspaceIdField, colorField, iconField } from './common.js';

export const createCategorySchema = z.object({
  workspaceId: workspaceIdField,
  name: z.string().min(1).max(100),
  color: colorField,
  icon: iconField,
});

export const updateCategorySchema = z.object({
  workspaceId: workspaceIdField,
  name: z.string().min(1).max(100).optional(),
  color: colorField,
  icon: iconField,
});

export const addPatternSchema = z.object({
  bankId: z.string().min(1),
  pattern: z.string().min(1).max(500),
  priority: z.number().int().min(0).default(0),
  workspaceId: workspaceIdField,
});

export const quickPatternSchema = z.object({
  pattern: z.string().min(1).max(500),
  bankId: z.string().min(1),
  workspaceId: workspaceIdField,
  transactionIndices: z.array(z.number().int()).optional(),
});

export const categoryPatternParams = z.object({
  id: z.coerce.number().int().positive(),
  patternId: z.coerce.number().int().positive(),
});
