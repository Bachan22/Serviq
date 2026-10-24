import { z } from 'zod';

export const updateWorkerProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  experienceYears: z.number().min(0).max(60).optional(),
  serviceRadiusKm: z.number().min(1).max(50).optional(),
  baseVisitingFee: z.number().min(50).max(10000).optional(),
  workingHours: z.record(z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  })).optional(),
});

export const updateWorkerAvailabilitySchema = z.object({
  isOnline: z.boolean(),
});

export const updateWorkerLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const addWorkerSkillSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  experienceMonths: z.number().int().min(1).max(600).default(12),
});

export const adminVerifyWorkerSchema = z.object({
  isVerified: z.boolean(),
  verificationStatus: z.enum(['UNVERIFIED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']),
});

export type UpdateWorkerProfileInput = z.infer<typeof updateWorkerProfileSchema>;
export type UpdateWorkerAvailabilityInput = z.infer<typeof updateWorkerAvailabilitySchema>;
export type UpdateWorkerLocationInput = z.infer<typeof updateWorkerLocationSchema>;
export type AddWorkerSkillInput = z.infer<typeof addWorkerSkillSchema>;
export type AdminVerifyWorkerInput = z.infer<typeof adminVerifyWorkerSchema>;
