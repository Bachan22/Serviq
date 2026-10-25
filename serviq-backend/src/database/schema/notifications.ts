import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { bookings } from './bookings';

export const notifications = pgTable('notifications', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'JOB_REQUEST', 'NEW_OFFER', 'COUNTER_RECEIVED', 'OFFER_ACCEPTED', 'ON_THE_WAY', 'JOB_STARTED', 'JOB_COMPLETED', 'PAYMENT_RECEIVED'
  isRead: boolean('is_read').notNull().default(false),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
