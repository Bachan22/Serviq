import { z } from 'zod';

export const topupWalletSchema = z.object({
  amount: z.number().min(100, 'Minimum wallet top-up is ₹100').max(50000),
  referenceId: z.string().max(100).optional(),
});

export const requestPayoutSchema = z.object({
  amount: z.number().min(200, 'Minimum withdrawal payout is ₹200').max(50000),
  payoutMethod: z.enum(['UPI', 'BANK_TRANSFER']).default('UPI'),
  payoutDetails: z.object({
    upiId: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g., worker@okhdfcbank)').optional(),
    accountNumber: z.string().min(8).max(20).optional(),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional(),
    accountHolderName: z.string().min(2).max(100).optional(),
  }),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

export type TopupWalletInput = z.infer<typeof topupWalletSchema>;
export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;
export type ListTransactionsQueryInput = z.infer<typeof listTransactionsQuerySchema>;
