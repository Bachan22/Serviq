import { pgTable, uuid, varchar, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workerProfiles } from './worker-profiles';

export const payoutRequests = pgTable('payout_requests', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('REQUESTED'), // REQUESTED, PROCESSING, COMPLETED, REJECTED
  payoutMethod: varchar('payout_method', { length: 30 }).notNull().default('UPI'), // UPI, BANK_TRANSFER
  payoutDetails: jsonb('payout_details').notNull(),
  transactionRef: varchar('transaction_ref', { length: 100 }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type PayoutRequest = typeof payoutRequests.$inferSelect;
export type NewPayoutRequest = typeof payoutRequests.$inferInsert;
