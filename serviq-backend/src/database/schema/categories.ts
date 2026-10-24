import { pgTable, uuid, varchar, text, integer, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const serviceCategories = pgTable('service_categories', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  iconKey: varchar('icon_key', { length: 50 }).notNull(), // e.g., 'Wrench', 'Zap', 'Sparkles'
  parentId: uuid('parent_id'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  typicalPriceMin: numeric('typical_price_min', { precision: 10, scale: 2 }),
  typicalPriceMax: numeric('typical_price_max', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type NewServiceCategory = typeof serviceCategories.$inferInsert;
