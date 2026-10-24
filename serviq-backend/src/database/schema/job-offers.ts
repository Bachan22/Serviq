import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bookings } from './bookings';
import { workerProfiles } from './worker-profiles';

export const jobOffers = pgTable('job_offers', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  jobId: uuid('job_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(), // 'accept' | 'counter'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type JobOffer = typeof jobOffers.$inferSelect;
export type NewJobOffer = typeof jobOffers.$inferInsert;
