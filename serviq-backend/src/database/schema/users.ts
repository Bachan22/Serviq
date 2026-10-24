import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  isPhoneVerified: boolean('is_phone_verified').notNull().default(false),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  status: varchar('status', { length: 30 }).notNull().default('ACTIVE'), // 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'
  isDemo: boolean('is_demo').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
