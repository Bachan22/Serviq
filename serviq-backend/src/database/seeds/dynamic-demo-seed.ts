import { db, client } from '../connection.js';
import { users, userRoles, roles, workerProfiles, serviceCategories, bookings, reviews } from '../schema/index.js';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import crypto from 'node:crypto';

export const DEMO_WORKERS_DATA = [
  { name: 'Ramesh Patil', skill: 'Plumbing', phone: '+919820000001', rate: '350.00', exp: '6.5', lat: 19.298, lng: 72.855, area: 'Bhayandar West' },
  { name: 'Suresh Kumar', skill: 'Electrical', phone: '+919820000002', rate: '400.00', exp: '8.0', lat: 19.284, lng: 72.868, area: 'Mira Road East' },
  { name: 'Amit More', skill: 'Carpentry', phone: '+919820000003', rate: '300.00', exp: '4.5', lat: 19.301, lng: 72.862, area: 'Bhayandar East' },
  { name: 'Kavita Sharma', skill: 'Cleaning', phone: '+919820000004', rate: '500.00', exp: '5.0', lat: 19.281, lng: 72.859, area: 'Mira Road West' },
  { name: 'Imran Shaikh', skill: 'AC repair', phone: '+919820000005', rate: '450.00', exp: '7.0', lat: 19.255, lng: 72.858, area: 'Dahisar West' },
  { name: 'Rajesh Vishwakarma', skill: 'Painting', phone: '+919820000006', rate: '350.00', exp: '9.0', lat: 19.205, lng: 72.842, area: 'Kandivali West' },
  { name: 'Sunita Gaikwad', skill: 'Cooking', phone: '+919820000007', rate: '400.00', exp: '10.0', lat: 19.299, lng: 72.852, area: 'Bhayandar West' },
  { name: 'Dinesh Chauhan', skill: 'Plumbing', phone: '+919820000008', rate: '380.00', exp: '5.5', lat: 19.286, lng: 72.871, area: 'Mira Road East' },
  { name: 'Ganesh Shinde', skill: 'Electrical', phone: '+919820000009', rate: '420.00', exp: '6.0', lat: 19.231, lng: 72.856, area: 'Borivali West' },
  { name: 'Pooja Rawat', skill: 'Cleaning', phone: '+919820000010', rate: '480.00', exp: '3.5', lat: 19.303, lng: 72.864, area: 'Bhayandar East' },
  { name: 'Fahim Ansari', skill: 'AC repair', phone: '+919820000011', rate: '460.00', exp: '5.0', lat: 19.292, lng: 72.865, area: 'Mira Road East' },
  { name: 'Manoj Suthar', skill: 'Carpentry', phone: '+919820000012', rate: '320.00', exp: '8.0', lat: 19.297, lng: 72.854, area: 'Bhayandar West' },
  { name: 'Geeta Nair', skill: 'Cooking', phone: '+919820000013', rate: '450.00', exp: '6.5', lat: 19.285, lng: 72.863, area: 'Mira Road West' },
  { name: 'Vijay Kanojia', skill: 'Painting', phone: '+919820000014', rate: '380.00', exp: '4.0', lat: 19.300, lng: 72.859, area: 'Bhayandar East' },
  { name: 'Anil Gupta', skill: 'Plumbing', phone: '+919820000015', rate: '360.00', exp: '7.5', lat: 19.288, lng: 72.869, area: 'Mira Road East' },
];

export async function runDemoSeed() {
  const isEnabled = process.env.ENABLE_DEMO_DATA === 'true' || process.argv.includes('--force');
  if (!isEnabled) {
    console.log('[Seed] Demo data disabled (ENABLE_DEMO_DATA is not set to true). Skipping demo seed.');
    return;
  }

  console.log('[Seed] Inserting 15 demo workers flagged with is_demo: true...');
  const defaultPw = await argon2.hash('DemoWorker2026!');

  try {
    for (const w of DEMO_WORKERS_DATA) {
      const email = `${w.name.toLowerCase().replace(/\s+/g, '.')}@demo.serviq.test`;
      
      // Upsert User
      let existingUser = await db.query.users.findFirst({
        where: eq(users.phoneNumber, w.phone),
      });

      let userId = existingUser?.id;
      if (!existingUser) {
        const [u] = await db.insert(users).values({
          phoneNumber: w.phone,
          email,
          passwordHash: defaultPw,
          isPhoneVerified: true,
          status: 'ACTIVE',
          isDemo: true,
        }).returning();
        userId = u.id;
      }

      if (userId) {
        // Upsert Worker Profile
        await db.insert(workerProfiles).values({
          id: userId,
          displayName: w.name,
          skill: w.skill,
          hourlyRate: w.rate,
          experienceYears: w.exp,
          latitude: w.lat,
          longitude: w.lng,
          serviceArea: w.area,
          isOnline: true,
          isVerified: true,
          verificationStatus: 'APPROVED',
          isDemo: true,
        }).onConflictDoUpdate({
          target: workerProfiles.id,
          set: {
            displayName: w.name,
            skill: w.skill,
            hourlyRate: w.rate,
            latitude: w.lat,
            longitude: w.lng,
            serviceArea: w.area,
            isOnline: true,
            isDemo: true,
          },
        });
      }
    }
    console.log('[Seed] 15 Demo workers inserted successfully.');
  } catch (err: any) {
    console.warn('[Seed] Offline or database unavailable. Local storage engine will provide demo seed when enabled.', err.message);
  }
}

if (process.argv[1]?.includes('dynamic-demo-seed')) {
  runDemoSeed().then(() => {
    client.end?.();
    process.exit(0);
  });
}
