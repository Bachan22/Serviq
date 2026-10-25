import { db, client } from '../connection.js';
import {
  users,
  userRoles,
  customerProfiles,
  workerProfiles,
  workerSkills,
  serviceCategories,
  bookings,
  reviews,
} from '../schema/index.js';
import { eq, or } from 'drizzle-orm';
import argon2 from 'argon2';

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
  console.log('[Seed] Seeding demo dataset flagged with is_demo: true...');
  const defaultPw = await argon2.hash('DemoWorker2026!');
  const categoriesList = await db.select().from(serviceCategories);

  const getCatId = (name: string) => {
    const found = categoriesList.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() || c.slug.toLowerCase() === name.toLowerCase()
    );
    return found ? found.id : categoriesList[0]?.id;
  };

  // 1. Seed Demo Customer Accounts
  console.log('[Seed] Creating demo customer and worker accounts...');
  const demoAccounts = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      phone: '+919820123456',
      email: 'customer.demo@serviq.test',
      name: 'Demo Customer',
      role: 'CUSTOMER',
      area: 'Bhayandar West, Mumbai',
      password: 'Serviq2026!',
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      phone: '+919820654321',
      email: 'worker.demo@serviq.test',
      name: 'Demo Worker',
      role: 'WORKER',
      skill: 'Plumbing',
      rate: '350.00',
      area: 'Bhayandar & Mira Road, Mumbai',
      password: 'Serviq2026!',
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      phone: '+919820123457',
      email: 'gurubachan011@gmail.com',
      name: 'Gurubachan Singh',
      role: 'CUSTOMER',
      area: 'Bhayandar West, Mumbai',
      password: 'gurubachan123',
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      phone: '+919820009999',
      email: 'rahul.demo@serviq.test',
      name: 'Rahul Sharma',
      role: 'CUSTOMER',
      area: 'Bhayandar West, Mumbai',
      password: 'Serviq2026!',
    },
  ];

  let customerUser: any = null;

  for (const acc of demoAccounts) {
    const pwHash = await argon2.hash(acc.password);
    let u = await db.query.users.findFirst({
      where: or(eq(users.phoneNumber, acc.phone), eq(users.email, acc.email)),
    });

    if (!u) {
      const [created] = await db
        .insert(users)
        .values({
          id: acc.id,
          phoneNumber: acc.phone,
          email: acc.email,
          passwordHash: pwHash,
          isPhoneVerified: true,
          status: 'ACTIVE',
          isDemo: true,
        })
        .returning();
      u = created;
    } else {
      await db.update(users).set({ passwordHash: pwHash, isDemo: true }).where(eq(users.id, u.id));
    }

    await db
      .insert(userRoles)
      .values({ userId: u.id, roleId: acc.role })
      .onConflictDoNothing();

    if (acc.role === 'CUSTOMER') {
      await db
        .insert(customerProfiles)
        .values({
          id: u.id,
          displayName: acc.name,
          area: acc.area,
          latitude: 19.298,
          longitude: 72.855,
          isDemo: true,
        })
        .onConflictDoUpdate({
          target: customerProfiles.id,
          set: { displayName: acc.name, area: acc.area, isDemo: true },
        });

      if (!customerUser) customerUser = u;
    } else if (acc.role === 'WORKER') {
      await db
        .insert(workerProfiles)
        .values({
          id: u.id,
          displayName: acc.name,
          skill: acc.skill || 'Plumbing',
          hourlyRate: acc.rate || '350.00',
          serviceArea: acc.area,
          serviceRadiusKm: '10.0',
          experienceYears: '6.0',
          isVerified: true,
          isOnline: true,
          latitude: 19.298,
          longitude: 72.855,
          isDemo: true,
        })
        .onConflictDoUpdate({
          target: workerProfiles.id,
          set: {
            displayName: acc.name,
            skill: acc.skill || 'Plumbing',
            hourlyRate: acc.rate || '350.00',
            serviceArea: acc.area,
            isVerified: true,
            isOnline: true,
            isDemo: true,
          },
        });
    }
  }

  // 2. Seed Demo Workers
  console.log(`[Seed] Inserting ${DEMO_WORKERS_DATA.length} demo workers...`);
  const workerIds: Record<string, string> = {};

  for (const w of DEMO_WORKERS_DATA) {
    const email = `${w.name.toLowerCase().replace(/\s+/g, '.')}@demo.serviq.test`;

    let user = await db.query.users.findFirst({
      where: eq(users.phoneNumber, w.phone),
    });

    if (!user) {
      const [u] = await db
        .insert(users)
        .values({
          phoneNumber: w.phone,
          email,
          passwordHash: defaultPw,
          isPhoneVerified: true,
          status: 'ACTIVE',
          isDemo: true,
        })
        .returning();
      user = u;
    }

    workerIds[w.name] = user.id;

    await db
      .insert(userRoles)
      .values({ userId: user.id, roleId: 'WORKER' })
      .onConflictDoNothing();

    await db
      .insert(workerProfiles)
      .values({
        id: user.id,
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
        averageRating: '4.85',
        totalReviewsCount: 12,
        completedJobsCount: 24,
        isDemo: true,
      })
      .onConflictDoUpdate({
        target: workerProfiles.id,
        set: {
          displayName: w.name,
          skill: w.skill,
          hourlyRate: w.rate,
          latitude: w.lat,
          longitude: w.lng,
          serviceArea: w.area,
          isOnline: true,
          isVerified: true,
          isDemo: true,
        },
      });

    // Link worker skill to category
    const catId = getCatId(w.skill);
    if (catId) {
      await db
        .insert(workerSkills)
        .values({ workerId: user.id, categoryId: catId, experienceMonths: 36 })
        .onConflictDoNothing();
    }
  }

  // 3. Seed Open Jobs (Broadcasts)
  console.log('[Seed] Seeding sample open broadcast jobs...');
  const sampleJobs = [
    {
      bookingNumber: 'DEMO-JOB-101',
      title: 'AC cooling coil issue and filter cleaning',
      description: 'Split AC is running but cooling is weak. Needs jet cleaning and pressure check.',
      skill: 'AC repair',
      budget: '600.00',
      area: 'Bhayandar West',
      lat: 19.298,
      lng: 72.855,
    },
    {
      bookingNumber: 'DEMO-JOB-102',
      title: 'Bathroom tap leaking and low water pressure',
      description: 'Main shower mixer is leaking continuously. Low pressure in bathroom.',
      skill: 'Plumbing',
      budget: '400.00',
      area: 'Mira Road East',
      lat: 19.284,
      lng: 72.868,
    },
    {
      bookingNumber: 'DEMO-JOB-103',
      title: 'Ceiling fan regulator replacement & MCB trip',
      description: 'Fan speed regulator is burned out and main switch tripped twice.',
      skill: 'Electrical',
      budget: '350.00',
      area: 'Bhayandar East',
      lat: 19.301,
      lng: 72.862,
    },
  ];

  for (const job of sampleJobs) {
    const existingJob = await db.query.bookings.findFirst({
      where: eq(bookings.bookingNumber, job.bookingNumber),
    });

    if (!existingJob) {
      const catId = getCatId(job.skill);
      await db.insert(bookings).values({
        bookingNumber: job.bookingNumber,
        customerId: customerUser.id,
        categoryId: catId,
        title: job.title,
        description: job.description,
        budget: job.budget,
        area: job.area,
        serviceAddressText: `${job.area}, Mumbai`,
        serviceLatitude: job.lat,
        serviceLongitude: job.lng,
        status: 'PENDING_ACCEPTANCE',
        dispatchType: 'BROADCAST',
        isDemo: true,
      });
    }
  }

  // 4. Seed a couple of demo reviews for demo workers
  console.log('[Seed] Seeding demo reviews for demo workers...');
  const firstWorker = workerIds['Ramesh Patil'];
  if (firstWorker) {
    const sampleCompletedJob = await db.query.bookings.findFirst({
      where: eq(bookings.bookingNumber, 'DEMO-JOB-COMPLETED-1'),
    });

    let completedJobId = sampleCompletedJob?.id;
    if (!sampleCompletedJob) {
      const catId = getCatId('Plumbing');
      const [comp] = await db
        .insert(bookings)
        .values({
          bookingNumber: 'DEMO-JOB-COMPLETED-1',
          customerId: customerUser.id,
          workerId: firstWorker,
          categoryId: catId,
          title: 'Kitchen sink pipe repair',
          description: 'Sink drainage fix completed smoothly.',
          budget: '450.00',
          agreedLaborPrice: '450.00',
          area: 'Bhayandar West',
          serviceAddressText: 'Bhayandar West, Mumbai',
          serviceLatitude: 19.298,
          serviceLongitude: 72.855,
          status: 'COMPLETED',
          dispatchType: 'DIRECT',
          isDemo: true,
        })
        .returning();
      completedJobId = comp.id;
    }

    if (completedJobId) {
      const existingRev = await db.query.reviews.findFirst({
        where: eq(reviews.bookingId, completedJobId),
      });

      if (!existingRev) {
        await db.insert(reviews).values({
          bookingId: completedJobId,
          customerId: customerUser.id,
          workerId: firstWorker,
          rating: 5,
          reviewText: 'Punctual, fast, and very clean work. Highly recommended!',
          comment: 'Punctual, fast, and very clean work. Highly recommended!',
          isPublished: true,
          isDemo: true,
        });
      }
    }
  }

  console.log('[Seed] Demo dataset seeding completed successfully.');
}

if (process.argv[1]?.includes('dynamic-demo-seed')) {
  runDemoSeed()
    .then(() => {
      client.end();
      process.exit(0);
    })
    .catch((e) => {
      console.error('[Seed Error]', e);
      client.end();
      process.exit(1);
    });
}
