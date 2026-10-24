import { pgTable, uuid, varchar, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { wallets } from './wallets';
import { bookings } from './bookings';

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(), // COMMISSION_DEDUCTION, CANCELLATION_COMPENSATION, ONLINE_PAYOUT, WALLET_TOPUP, WITHDRAWAL, PENALTY, REFUND
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(), // Positive for credit, negative for debit
  balanceBefore: numeric('balance_before', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 10, scale: 2 }).notNull(),
  referenceId: varchar('reference_id', { length: 100 }),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type NewWalletTransaction = typeof walletTransactions.$inferInsert;
