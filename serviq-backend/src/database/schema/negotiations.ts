import { pgTable, uuid, varchar, text, integer, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bookings } from './bookings';
import { users } from './users';

export const negotiationRounds = pgTable('negotiation_rounds', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderRole: varchar('sender_role', { length: 20 }).notNull(), // CUSTOMER, WORKER
  roundNumber: integer('round_number').notNull(),
  proposedLaborPrice: numeric('proposed_labor_price', { precision: 10, scale: 2 }).notNull(),
  proposedPartsPrice: numeric('proposed_parts_price', { precision: 10, scale: 2 }).notNull().default('0.00'),
  itemizedLaborDetails: text('itemized_labor_details'),
  itemizedPartsDetails: jsonb('itemized_parts_details').default([]),
  status: varchar('status', { length: 30 }).notNull().default('PENDING'), // PENDING, ACCEPTED, COUNTERED, REJECTED, EXPIRED
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type NegotiationRound = typeof negotiationRounds.$inferSelect;
export type NewNegotiationRound = typeof negotiationRounds.$inferInsert;
