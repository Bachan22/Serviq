import { pgTable, varchar, text, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const roles = pgTable('roles', {
  id: varchar('id', { length: 30 }).primaryKey(), // 'CUSTOMER', 'WORKER', 'ADMIN', 'SUPPORT'
  description: text('description').notNull(),
});

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: varchar('role_id', { length: 30 }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));

export type Role = typeof roles.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
