import { z } from 'zod';

export const submitEstimateSchema = z.object({
  proposedLaborPrice: z.number().min(50, 'Minimum labor estimate is ₹50').max(50000),
  proposedPartsPrice: z.number().min(0).max(50000).default(0),
  itemizedLaborDetails: z.string().min(5, 'Please provide labor work details').max(1000),
  itemizedPartsDetails: z.array(z.object({
    name: z.string().min(1),
    price: z.number().min(0),
    quantity: z.number().int().min(1).default(1),
  })).optional().default([]),
});

export const respondEstimateSchema = z.object({
  action: z.enum(['ACCEPT', 'COUNTER', 'REJECT']),
  counterLaborPrice: z.number().min(50).max(50000).optional(),
  counterReason: z.string().max(500).optional(),
});

export type SubmitEstimateInput = z.infer<typeof submitEstimateSchema>;
export type RespondEstimateInput = z.infer<typeof respondEstimateSchema>;
