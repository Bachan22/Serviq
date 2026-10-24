import { pgTable, uuid, varchar, boolean, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customerProfiles } from './customer-profiles';

export const addresses = pgTable('addresses', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => customerProfiles.id, { onDelete: 'cascade' }),
  addressLabel: varchar('address_label', { length: 50 }).notNull(), // 'Home', 'Office', 'Other'
  recipientName: varchar('recipient_name', { length: 100 }),
  recipientPhone: varchar('recipient_phone', { length: 20 }),
  addressLine1: varchar('address_line_1', { length: 255 }).notNull(),
  addressLine2: varchar('address_line_2', { length: 255 }),
  locality: varchar('locality', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull().default('Maharashtra'),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
