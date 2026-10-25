import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { serviceCategories } from './categories';

export const serviceIssues = pgTable('service_issues', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  serviceId: uuid('service_id').notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 150 }).notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ServiceIssue = typeof serviceIssues.$inferSelect;
export type NewServiceIssue = typeof serviceIssues.$inferInsert;
