import { z } from 'zod';

export const createDirectBookingSchema = z.object({
  workerId: z.string().uuid('Invalid worker ID'),
  categoryId: z.string().uuid('Invalid category ID'),
  addressId: z.string().uuid('Invalid address ID'),
  scheduledFor: z.string().datetime().optional(),
  customerNotes: z.string().max(1000).optional(),
  audioNoteUrl: z.string().url().optional(),
  problemImages: z.array(z.string().url()).max(5).optional().default([]),
});

export const createBroadcastBookingSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  addressId: z.string().uuid('Invalid address ID'),
  searchRadiusKm: z.number().min(1).max(30).default(10),
  scheduledFor: z.string().datetime().optional(),
  customerNotes: z.string().max(1000).optional(),
  audioNoteUrl: z.string().url().optional(),
  problemImages: z.array(z.string().url()).max(5).optional().default([]),
});

export const workerRespondDirectSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE']),
  declineReason: z.string().max(500).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['ARRIVED', 'IN_PROGRESS', 'PAYMENT_PENDING', 'COMPLETED']),
});

export const cancelBookingSchema = z.object({
  cancellationReason: z.string().min(3, 'Cancellation reason is required').max(500),
});

export const listBookingsQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateDirectBookingInput = z.infer<typeof createDirectBookingSchema>;
export type CreateBroadcastBookingInput = z.infer<typeof createBroadcastBookingSchema>;
export type WorkerRespondDirectInput = z.infer<typeof workerRespondDirectSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type ListBookingsQueryInput = z.infer<typeof listBookingsQuerySchema>;
