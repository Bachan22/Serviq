import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { conversations } from './conversations';

export const messages = pgTable('messages', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: varchar('sender_id', { length: 100 }).notNull(),
  body: text('body').notNull(),
  isSystemNotice: boolean('is_system_notice').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  readAt: timestamp('read_at', { withTimezone: true }),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
