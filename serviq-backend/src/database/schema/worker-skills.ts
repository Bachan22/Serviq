import { pgTable, uuid, integer, primaryKey } from 'drizzle-orm/pg-core';
import { workerProfiles } from './worker-profiles';
import { serviceCategories } from './categories';

export const workerSkills = pgTable('worker_skills', {
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
  experienceMonths: integer('experience_months').notNull().default(12),
}, (table) => ({
  pk: primaryKey({ columns: [table.workerId, table.categoryId] }),
}));

export type WorkerSkill = typeof workerSkills.$inferSelect;
export type NewWorkerSkill = typeof workerSkills.$inferInsert;
