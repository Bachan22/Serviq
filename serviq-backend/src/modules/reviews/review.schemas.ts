import { z } from 'zod';

export const createReviewSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  reviewText: z.string().max(1000).optional(),
  categoryRatings: z.record(z.number().int().min(1).max(5)).optional().default({}),
});

export const replyReviewSchema = z.object({
  workerReply: z.string().min(2, 'Reply must be at least 2 characters').max(500),
});

export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReplyReviewInput = z.infer<typeof replyReviewSchema>;
export type ListReviewsQueryInput = z.infer<typeof listReviewsQuerySchema>;
