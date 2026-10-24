import { db, client } from '../connection.js';
import { users, workerProfiles, customerProfiles, bookings, reviews } from '../schema/index.js';
import { eq } from 'drizzle-orm';

export async function runCleanSeed() {
  console.log('[Seed Clean] Deleting all records where is_demo = true...');
  try {
    await db.delete(reviews).where(eq(reviews.isDemo, true));
    await db.delete(bookings).where(eq(bookings.isDemo, true));
    await db.delete(workerProfiles).where(eq(workerProfiles.isDemo, true));
    await db.delete(customerProfiles).where(eq(customerProfiles.isDemo, true));
    await db.delete(users).where(eq(users.isDemo, true));
    console.log('[Seed Clean] All demo rows successfully removed from database.');
  } catch (err: any) {
    console.warn('[Seed Clean] Database offline or skipped:', err.message);
  }
}

if (process.argv[1]?.includes('clean-demo-seed')) {
  runCleanSeed().then(() => {
    client.end?.();
    process.exit(0);
  });
}
