import { z } from 'zod';

export const updateCustomerProfileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url('Avatar must be a valid URL').optional().or(z.literal('')),
  emergencyPhone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Emergency phone must be in E.164 format').optional().or(z.literal('')),
});

export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
