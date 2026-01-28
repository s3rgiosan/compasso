import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128),
  email: z.string().email().max(254),
  displayName: z.string().max(100).optional(),
  locale: z.enum(['en', 'pt']).optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(100).nullable().optional(),
  email: z.string().email().max(254).optional(),
  locale: z.enum(['en', 'pt']).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
