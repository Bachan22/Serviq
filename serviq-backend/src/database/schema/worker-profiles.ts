import { pgTable, uuid, varchar, text, numeric, integer, boolean, jsonb, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const workerProfiles = pgTable('worker_profiles', {
  id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  experienceYears: numeric('experience_years', { precision: 3, scale: 1 }).notNull().default('1.0'),
  isVerified: boolean('is_verified').notNull().default(false), // Admin approval required
  verificationStatus: varchar('verification_status', { length: 30 }).notNull().default('UNVERIFIED'), // UNVERIFIED, PENDING_REVIEW, APPROVED, REJECTED
  isOnline: boolean('is_online').notNull().default(false),
  serviceRadiusKm: numeric('service_radius_km', { precision: 4, scale: 1 }).notNull().default('10.0'),
  baseVisitingFee: numeric('base_visiting_fee', { precision: 10, scale: 2 }).notNull().default('250.00'),
  workingHours: jsonb('working_hours').default({
    monday: { start: '09:00', end: '18:00' },
    tuesday: { start: '09:00', end: '18:00' },
    wednesday: { start: '09:00', end: '18:00' },
    thursday: { start: '09:00', end: '18:00' },
    friday: { start: '09:00', end: '18:00' },
    saturday: { start: '09:00', end: '18:00' },
    sunday: { start: '10:00', end: '16:00' },
  }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  lastLocationUpdatedAt: timestamp('last_location_updated_at', { withTimezone: true }),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
  totalReviewsCount: integer('total_reviews_count').notNull().default(0),
  completedJobsCount: integer('completed_jobs_count').notNull().default(0),
  profileCompletenessPct: integer('profile_completeness_pct').notNull().default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type WorkerProfile = typeof workerProfiles.$inferSelect;
export type NewWorkerProfile = typeof workerProfiles.$inferInsert;
