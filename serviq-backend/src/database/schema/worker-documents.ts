import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workerProfiles } from './worker-profiles';
import { users } from './users';

export const workerDocuments = pgTable('worker_documents', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 50 }).notNull(), // AADHAAR_FRONT, AADHAAR_BACK, PAN_CARD, DRIVING_LICENSE, TRADE_CERTIFICATE
  documentNumber: varchar('document_number', { length: 100 }),
  documentUrl: text('document_url').notNull(),
  verificationStatus: varchar('verification_status', { length: 30 }).notNull().default('PENDING'), // PENDING, APPROVED, REJECTED
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type WorkerDocument = typeof workerDocuments.$inferSelect;
export type NewWorkerDocument = typeof workerDocuments.$inferInsert;
