import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';
import { env } from '../config/env.js';

const isSupabase = env.DATABASE_URL.includes('supabase.co');
const isTransactionPooler = env.DATABASE_URL.includes(':6543') || env.DATABASE_URL.includes('pooler');
const requireSsl = isSupabase || env.DATABASE_URL.includes('sslmode=require') || env.NODE_ENV === 'production';

export const client = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
  ssl: requireSsl ? 'require' : undefined,
  prepare: !isTransactionPooler,
});

export const db = drizzle(client, { schema });
