import { z } from 'zod';

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters'),
});

export const getOrCreateConversationSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetOrCreateConversationInput = z.infer<typeof getOrCreateConversationSchema>;
