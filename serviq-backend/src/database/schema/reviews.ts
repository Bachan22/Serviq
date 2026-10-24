import { pgTable, uuid, integer, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bookings } from './bookings';
import { customerProfiles } from './customer-profiles';
import { workerProfiles } from './worker-profiles';

export const reviews = pgTable('reviews', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  bookingId: uuid('booking_id').notNull().unique().references(() => bookings.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customerProfiles.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(), // 1 to 5
  reviewText: text('review_text'),
  comment: text('comment'),
  categoryRatings: jsonb('category_ratings').default({}), // e.g. { punctuality: 5, quality: 5, behavior: 5 }
  workerReply: text('worker_reply'),
  workerRepliedAt: timestamp('worker_replied_at', { withTimezone: true }),
  isPublished: boolean('is_published').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
