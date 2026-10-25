import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().optional(),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  START_CODE_SECRET: z.string().min(8, 'START_CODE_SECRET is required and must be at least 8 characters').default('serviq_start_code_hmac_secret_key_default'),
  WISPR_API_KEY: z.string().optional(),

  SMS_DEV_MOCK_MODE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  SMS_GATEWAY_API_KEY: z.string().optional(),

  // Configurable Business Rules
  COMMISSION_LABOR_RATE_PCT: z.coerce.number().min(0).max(50).default(10),
  CANCEL_TRIP_FEE_AMOUNT: z.coerce.number().min(0).default(100),
  CANCEL_GRACE_PERIOD_MINS: z.coerce.number().min(0).default(5),
  CANCEL_WORKER_SHARE_PCT: z.coerce.number().min(0).max(100).default(85),
  CANCEL_PLATFORM_SHARE_PCT: z.coerce.number().min(0).max(100).default(15),
  WALLET_MAX_NEGATIVE_LIMIT: z.coerce.number().max(0).default(-1500),
  MAX_NEGOTIATION_ROUNDS: z.coerce.number().min(1).max(5).default(2),
  OFFER_EXPIRY_MINS: z.coerce.number().min(1).max(120).default(15),
  DEFAULT_SEARCH_RADIUS_KM: z.coerce.number().min(1).max(50).default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Environment configuration validation failed.');
}

const rawData = parsed.data;

// Resolve JWT secret: accept either JWT_SECRET or JWT_ACCESS_SECRET
const jwtSecret = rawData.JWT_SECRET || rawData.JWT_ACCESS_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  throw new Error('JWT_SECRET (or JWT_ACCESS_SECRET) is required and must be at least 16 characters.');
}

export const env = {
  ...rawData,
  JWT_ACCESS_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: rawData.JWT_REFRESH_SECRET || jwtSecret,
  getAllowedOrigins(): string[] {
    const list: string[] = [];
    if (rawData.ALLOWED_ORIGINS) {
      list.push(...rawData.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean));
    }
    if (rawData.CORS_ORIGIN) {
      list.push(...rawData.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean));
    }
    list.push('http://localhost:5173', 'http://127.0.0.1:5173');
    return [...new Set(list)];
  },
};
