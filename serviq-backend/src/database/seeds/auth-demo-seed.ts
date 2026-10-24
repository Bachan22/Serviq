import argon2 from 'argon2';

export interface SeedWorker {
  id: string;
  name: string;
  job: string;
  primarySkill: string;
  rating: number;
  reviews: number;
  price: number;
  distance: string;
  initials: string;
  color: string;
  verified: boolean;
  jobs: number;
  time: string;
  location: string;
}

export const DEMO_PASSWORD = 'Serviq2026!';

export const SEED_DEMO_ACCOUNTS = {
  customer: {
    email: 'customer.demo@serviq.test',
    password: DEMO_PASSWORD,
    fullName: 'Gurubachan Singh',
    role: 'customer' as const,
    phoneNumber: '+919820123456',
    city: 'Bhayandar West, Mumbai',
  },
  worker: {
    email: 'worker.demo@serviq.test',
    password: DEMO_PASSWORD,
    fullName: 'Ramesh Patil',
    role: 'worker' as const,
    phoneNumber: '+919820654321',
    primarySkill: 'Plumber',
    experienceYears: 6.5,
    serviceArea: 'Bhayandar & Mira Road, Mumbai',
    hourlyRate: 350,
    verificationStatus: 'pending' as const,
  },
};

export const SEED_WORKERS: SeedWorker[] = [
  { id: 'worker-1', name: 'Ramesh Patil', job: 'Plumbing specialist', primarySkill: 'Plumber', rating: 4.9, reviews: 128, price: 350, distance: '1.2 km away', initials: 'RP', color: 'sand', verified: true, jobs: 286, time: '20–30 min', location: 'Bhayandar West' },
  { id: 'worker-2', name: 'Suresh Kumar', job: 'Master Electrician', primarySkill: 'Electrician', rating: 4.8, reviews: 96, price: 400, distance: '1.8 km away', initials: 'SK', color: 'blue', verified: true, jobs: 214, time: '25–35 min', location: 'Mira Road East' },
  { id: 'worker-3', name: 'Amit More', job: 'Home Maintenance & Carpentry', primarySkill: 'Carpenter', rating: 4.7, reviews: 74, price: 300, distance: '2.4 km away', initials: 'AM', color: 'green', verified: true, jobs: 178, time: '30–40 min', location: 'Bhayandar East' },
  { id: 'worker-4', name: 'Kavita Sharma', job: 'Deep Cleaning & Sanitization', primarySkill: 'Cleaner', rating: 4.9, reviews: 142, price: 500, distance: '1.5 km away', initials: 'KS', color: 'sand', verified: true, jobs: 310, time: '15–25 min', location: 'Mira Road West' },
  { id: 'worker-5', name: 'Imran Shaikh', job: 'AC & Cooling Technician', primarySkill: 'AC repair', rating: 4.8, reviews: 110, price: 450, distance: '2.1 km away', initials: 'IS', color: 'blue', verified: true, jobs: 195, time: '30–45 min', location: 'Dahisar West' },
  { id: 'worker-6', name: 'Rajesh Vishwakarma', job: 'Interior & Exterior Painter', primarySkill: 'Painter', rating: 4.6, reviews: 68, price: 350, distance: '3.0 km away', initials: 'RV', color: 'green', verified: true, jobs: 140, time: '40–50 min', location: 'Kandivali West' },
  { id: 'worker-7', name: 'Sunita Gaikwad', job: 'Home Cook & Meal Prep', primarySkill: 'Cook', rating: 4.9, reviews: 88, price: 400, distance: '1.9 km away', initials: 'SG', color: 'sand', verified: true, jobs: 165, time: '20–30 min', location: 'Bhayandar West' },
  { id: 'worker-8', name: 'Dinesh Chauhan', job: 'Emergency Plumbing & Drainage', primarySkill: 'Plumber', rating: 4.7, reviews: 83, price: 380, distance: '2.8 km away', initials: 'DC', color: 'blue', verified: true, jobs: 152, time: '25–35 min', location: 'Mira Road East' },
  { id: 'worker-9', name: 'Ganesh Shinde', job: 'Inverter & Wiring Specialist', primarySkill: 'Electrician', rating: 4.8, reviews: 94, price: 420, distance: '3.4 km away', initials: 'GS', color: 'green', verified: true, jobs: 204, time: '35–45 min', location: 'Borivali West' },
  { id: 'worker-10', name: 'Pooja Rawat', job: 'Express Kitchen & Bath Clean', primarySkill: 'Cleaner', rating: 4.9, reviews: 119, price: 480, distance: '2.0 km away', initials: 'PR', color: 'sand', verified: true, jobs: 220, time: '20–30 min', location: 'Bhayandar East' },
];

export async function runAuthSeed() {
  console.log('Seeding demo accounts and realistic Mumbai workers...');
  console.log('Customer Demo:', SEED_DEMO_ACCOUNTS.customer.email, '| Password:', SEED_DEMO_ACCOUNTS.customer.password);
  console.log('Worker Demo:', SEED_DEMO_ACCOUNTS.worker.email, '| Password:', SEED_DEMO_ACCOUNTS.worker.password);
  console.log(`Seeded ${SEED_WORKERS.length} realistic workers.`);
  return {
    accounts: SEED_DEMO_ACCOUNTS,
    workers: SEED_WORKERS,
  };
}

if (process.argv[1]?.endsWith('auth-demo-seed.ts')) {
  runAuthSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
