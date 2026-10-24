import { z } from 'zod';

const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
const commonPasswords = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty123', 'admin123', 'welcome123', 'serviq123', 'letmein123'
]);

export const allowedSkills = [
  'Plumber',
  'Electrician',
  'Painter',
  'Cleaner',
  'Cook',
  'Carpenter',
  'AC repair',
  'Other'
] as const;

export const signupSchema = z.object({
  role: z.enum(['customer', 'worker'], {
    errorMap: () => ({ message: "Role must be strictly 'customer' or 'worker'." })
  }),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phoneNumber: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit Indian mobile number (+91 optional)'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .refine((val) => !commonPasswords.has(val.toLowerCase()), {
      message: 'Password is too common and easily guessed. Please choose a stronger password.'
    }),
  confirmPassword: z.string().optional(),
  city: z.string().trim().optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions.' })
  }),
  // Honeypot field - must be empty
  website: z.string().optional(),
  
  // Worker-specific fields
  primarySkill: z.enum(allowedSkills).optional(),
  experienceYears: z.coerce.number().min(0, 'Experience years must be 0 or greater').max(60).optional(),
  serviceArea: z.string().trim().optional(),
  hourlyRate: z.coerce.number().min(50, 'Minimum base rate is ₹50/hr').max(20000).optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'worker') {
    if (!data.primarySkill) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primarySkill'],
        message: 'Primary skill is required for worker accounts.'
      });
    }
    if (data.experienceYears === undefined || isNaN(data.experienceYears)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['experienceYears'],
        message: 'Years of experience is required for worker accounts.'
      });
    }
    if (!data.serviceArea || data.serviceArea.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serviceArea'],
        message: 'Service area / city is required for worker accounts.'
      });
    }
    if (data.hourlyRate === undefined || isNaN(data.hourlyRate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hourlyRate'],
        message: 'Base hourly rate is required for worker accounts.'
      });
    }
  }
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid or expired reset token'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .refine((val) => !commonPasswords.has(val.toLowerCase()), {
      message: 'Password is too common. Please choose a stronger password.'
    }),
});

export const requestOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be a valid international E.164 format (e.g. +919876543210)'),
});

export const verifyOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be digits only'),
  requestedRole: z.enum(['CUSTOMER', 'WORKER']).default('CUSTOMER'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
