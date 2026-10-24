import { pgTable, uuid, varchar, text, numeric, jsonb, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customerProfiles } from './customer-profiles';
import { workerProfiles } from './worker-profiles';
import { serviceCategories } from './categories';
import { addresses } from './addresses';

export const bookings = pgTable('bookings', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  bookingNumber: varchar('booking_number', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customerProfiles.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').references(() => workerProfiles.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').notNull().references(() => serviceCategories.id, { onDelete: 'restrict' }),
  addressId: uuid('address_id').references(() => addresses.id, { onDelete: 'set null' }),
  serviceAddressText: text('service_address_text').notNull(),
  serviceLatitude: doublePrecision('service_latitude').notNull(),
  serviceLongitude: doublePrecision('service_longitude').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PENDING_ACCEPTANCE'),
  dispatchType: varchar('dispatch_type', { length: 20 }).notNull().default('DIRECT'), // DIRECT, BROADCAST
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  customerNotes: text('customer_notes'),
  audioNoteUrl: text('audio_note_url'),
  problemImages: jsonb('problem_images').default([]),
  agreedLaborPrice: numeric('agreed_labor_price', { precision: 10, scale: 2 }),
  agreedPartsPrice: numeric('agreed_parts_price', { precision: 10, scale: 2 }).default('0.00'),
  finalTotalPrice: numeric('final_total_price', { precision: 10, scale: 2 }),
  paymentMethod: varchar('payment_method', { length: 30 }).default('CASH_ON_DELIVERY'),
  paymentStatus: varchar('payment_status', { length: 30 }).default('PENDING'),
  cancellationReason: text('cancellation_reason'),
  cancelledBy: varchar('cancelled_by', { length: 30 }),
  cancellationTripFee: numeric('cancellation_trip_fee', { precision: 10, scale: 2 }).default('0.00'),
  workerCancellationShare: numeric('worker_cancellation_share', { precision: 10, scale: 2 }).default('0.00'),
  platformCancellationFee: numeric('platform_cancellation_fee', { precision: 10, scale: 2 }).default('0.00'),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
