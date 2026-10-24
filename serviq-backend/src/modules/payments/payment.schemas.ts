import { z } from 'zod';

export const processPaymentSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'ONLINE_UPI', 'ONLINE_CARD']),
  gatewayPaymentId: z.string().optional(),
});

export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
