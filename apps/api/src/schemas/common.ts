import { z } from 'zod';

export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const workspaceIdParam = z.object({
  workspaceId: z.coerce.number().int().positive(),
});

export const workspaceAndUserIdParams = z.object({
  workspaceId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

export const workspaceIdField = z.coerce.number().int().positive();

export const colorField = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, 'Invalid hex color')
  .optional();

export const iconField = z.string().optional();

export const nameField = z.string().min(1).max(100);
