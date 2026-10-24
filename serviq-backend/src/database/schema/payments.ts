import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bookings } from './bookings';
import { customerProfiles } from './customer-profiles';

export const payments = pgTable('payments', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customerProfiles.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // CASH_ON_DELIVERY, ONLINE_UPI, ONLINE_CARD
  gatewayOrderId: varchar('gateway_order_id', { length: 100 }),
  gatewayPaymentId: varchar('gateway_payment_id', { length: 100 }),
  gatewaySignature: varchar('gateway_signature', { length: 255 }),
  status: varchar('status', { length: 30 }).notNull().default('PENDING'), // PENDING, SUCCESS, FAILED, REFUNDED
  laborAmount: numeric('labor_amount', { precision: 10, scale: 2 }).notNull(),
  partsAmount: numeric('parts_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  platformCommission: numeric('platform_commission', { precision: 10, scale: 2 }).notNull().default('0.00'),
  workerPayoutAmount: numeric('worker_payout_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
