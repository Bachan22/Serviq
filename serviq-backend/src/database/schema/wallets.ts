import { pgTable, uuid, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workerProfiles } from './worker-profiles';

export const wallets = pgTable('wallets', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  workerId: uuid('worker_id').notNull().unique().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  currentBalance: numeric('current_balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
  lockedBalance: numeric('locked_balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalEarned: numeric('total_earned', { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalCommissionPaid: numeric('total_commission_paid', { precision: 10, scale: 2 }).notNull().default('0.00'),
  isFrozen: boolean('is_frozen').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
