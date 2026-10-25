import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const conversations = pgTable('conversations', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  bookingId: varchar('booking_id', { length: 50 }).notNull().unique(),
  customerId: varchar('customer_id', { length: 100 }).notNull(),
  workerId: varchar('worker_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
