import { pgTable, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customerProfiles } from './customer-profiles';
import { workerProfiles } from './worker-profiles';

export const savedWorkers = pgTable('saved_workers', {
  customerId: uuid('customer_id').notNull().references(() => customerProfiles.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.customerId, table.workerId] }),
}));

export type SavedWorker = typeof savedWorkers.$inferSelect;
export type NewSavedWorker = typeof savedWorkers.$inferInsert;
