import { z } from 'zod';

export const submitWorkerDocumentSchema = z.object({
  documentType: z.enum(['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'DRIVING_LICENSE', 'TRADE_CERTIFICATE']),
  documentNumber: z.string().max(100).optional(),
  documentUrl: z.string().url('Document URL must be a valid link'),
});

export const reviewWorkerDocumentSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(500).optional(),
});

export const verifyWorkerProfileSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().max(500).optional(),
});

export type SubmitWorkerDocumentInput = z.infer<typeof submitWorkerDocumentSchema>;
export type ReviewWorkerDocumentInput = z.infer<typeof reviewWorkerDocumentSchema>;
export type VerifyWorkerProfileInput = z.infer<typeof verifyWorkerProfileSchema>;
