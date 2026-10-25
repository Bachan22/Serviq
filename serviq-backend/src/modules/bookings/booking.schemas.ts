import { z } from 'zod';

export const createDirectBookingSchema = z.object({
  workerId: z.string().uuid('Invalid worker ID'),
  categoryId: z.string().optional(),
  service: z.string().optional(),
  addressId: z.string().optional(),
  address: z.string().optional(),
  serviceAddressText: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  details: z.string().max(2000).optional(),
  budget: z.coerce.number().min(50).max(50000).optional(),
  initialOfferPrice: z.coerce.number().min(50).max(50000).optional(),
  pricingMode: z.string().optional(),
  scheduledFor: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  customerNotes: z.string().max(1000).optional(),
  audioNoteUrl: z.string().url().optional(),
  problemImages: z.array(z.string().url()).max(5).optional().default([]),
});

export const createBroadcastBookingSchema = z.object({
  categoryId: z.string().optional(),
  service: z.string().optional(),
  category: z.string().optional(),
  addressId: z.string().optional(),
  address: z.string().optional(),
  serviceAddressText: z.string().optional(),
  area: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  details: z.string().max(2000).optional(),
  budget: z.coerce.number().min(50).max(50000).optional(),
  searchRadiusKm: z.coerce.number().min(1).max(50).default(10),
  scheduledFor: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  customerNotes: z.string().max(1000).optional(),
  audioNoteUrl: z.string().url().optional(),
  problemImages: z.array(z.string().url()).max(5).optional().default([]),
});

export const workerRespondDirectSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE']),
  declineReason: z.string().max(500).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'PAYMENT_PENDING', 'COMPLETED', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'completed']),
  startCode: z.string().regex(/^\d{4}$/, 'Start code must be exactly 4 digits').optional(),
});

export const createJobOfferSchema = z.object({
  price: z.coerce.number().min(50, 'Minimum price is ₹50').max(50000, 'Maximum price is ₹50,000'),
  kind: z.enum(['accept', 'counter']),
  reason: z.string().max(500).optional(),
});

export const counterJobOfferSchema = z.object({
  price: z.coerce.number().min(50, 'Minimum price is ₹50').max(50000, 'Maximum price is ₹50,000'),
  reason: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  cancellationReason: z.string().min(3, 'Cancellation reason is required').max(500),
});

export const listBookingsQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const updateBookingLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type CreateDirectBookingInput = z.infer<typeof createDirectBookingSchema>;
export type CreateBroadcastBookingInput = z.infer<typeof createBroadcastBookingSchema>;
export type WorkerRespondDirectInput = z.infer<typeof workerRespondDirectSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type CreateJobOfferInput = z.infer<typeof createJobOfferSchema>;
export type CounterJobOfferInput = z.infer<typeof counterJobOfferSchema>;
export type UpdateBookingLocationInput = z.infer<typeof updateBookingLocationSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type ListBookingsQueryInput = z.infer<typeof listBookingsQuerySchema>;
