import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

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

export const env = parsed.data;
