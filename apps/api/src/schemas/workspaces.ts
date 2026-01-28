import { z } from 'zod';
import { colorField, iconField } from './common.js';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: colorField,
  icon: iconField,
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: colorField,
  icon: iconField,
});
