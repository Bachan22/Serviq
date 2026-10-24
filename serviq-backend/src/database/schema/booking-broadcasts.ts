import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bookings } from './bookings';
import { workerProfiles } from './worker-profiles';

export const bookingBroadcasts = pgTable('booking_broadcasts', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).notNull().default('SENT'), // SENT, CLAIMED, DECLINED, EXPIRED
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
});

export type BookingBroadcast = typeof bookingBroadcasts.$inferSelect;
export type NewBookingBroadcast = typeof bookingBroadcasts.$inferInsert;
