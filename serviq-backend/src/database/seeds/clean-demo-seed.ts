import { db, client } from '../connection.js';
import {
  users,
  workerProfiles,
  customerProfiles,
  bookings,
  reviews,
  jobOffers,
  bookingBroadcasts,
  negotiationRounds,
  workerSkills,
  userRoles,
} from '../schema/index.js';
import { eq, inArray } from 'drizzle-orm';

export async function runCleanSeed() {
  console.log('[Seed Clean] Deleting all records where is_demo = true...');
  try {
    // 1. Delete reviews
    await db.delete(reviews).where(eq(reviews.isDemo, true));

    // 2. Delete job offers, broadcasts, negotiation rounds associated with demo jobs
    const demoBookings = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.isDemo, true));
    const demoBookingIds = demoBookings.map((b) => b.id);
    if (demoBookingIds.length > 0) {
      await db.delete(jobOffers).where(inArray(jobOffers.jobId, demoBookingIds));
      await db.delete(bookingBroadcasts).where(inArray(bookingBroadcasts.bookingId, demoBookingIds));
      await db.delete(negotiationRounds).where(inArray(negotiationRounds.bookingId, demoBookingIds));
      await db.delete(bookings).where(eq(bookings.isDemo, true));
    }

    // 3. Delete demo worker profiles and skills
    const demoWorkers = await db.select({ id: workerProfiles.id }).from(workerProfiles).where(eq(workerProfiles.isDemo, true));
    const demoWorkerIds = demoWorkers.map((w) => w.id);
    if (demoWorkerIds.length > 0) {
      await db.delete(workerSkills).where(inArray(workerSkills.workerId, demoWorkerIds));
      await db.delete(jobOffers).where(inArray(jobOffers.workerId, demoWorkerIds));
      await db.delete(workerProfiles).where(eq(workerProfiles.isDemo, true));
    }

    // 4. Delete demo customer profiles
    await db.delete(customerProfiles).where(eq(customerProfiles.isDemo, true));

    // 5. Delete demo users and user roles
    const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.isDemo, true));
    const demoUserIds = demoUsers.map((u) => u.id);
    if (demoUserIds.length > 0) {
      await db.delete(userRoles).where(inArray(userRoles.userId, demoUserIds));
      await db.delete(users).where(eq(users.isDemo, true));
    }

    console.log('[Seed Clean] All demo rows successfully removed from database.');
  } catch (err: any) {
    console.warn('[Seed Clean] Error removing demo rows:', err.message);
  }
}

if (process.argv[1]?.includes('clean-demo-seed')) {
  runCleanSeed()
    .then(() => {
      client.end();
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      client.end();
      process.exit(1);
    });
}
