import { z } from 'zod';

const phoneRegex = /^\+[1-9]\d{1,14}$/;

export const requestOtpSchema = z.object({
  phoneNumber: z.string().regex(phoneRegex, 'Phone number must be a valid international E.164 format (e.g. +919876543210)'),
});

export const verifyOtpSchema = z.object({
  phoneNumber: z.string().regex(phoneRegex, 'Invalid phone number format'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be digits only'),
  requestedRole: z.enum(['CUSTOMER', 'WORKER']).default('CUSTOMER'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(), // Can also come from cookie
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
