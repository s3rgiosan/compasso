import { z } from 'zod';

export const inviteUserSchema = z.object({
  usernameOrEmail: z.string().min(1).max(100),
  role: z.enum(['editor', 'viewer']),
});

export const changeMemberRoleSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
});
