import 'dotenv/config';
import { db } from '../src/database/connection.js';
import { roles, users, customerProfiles, workerProfiles } from '../src/database/schema/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const allRoles = await db.select().from(roles);
  console.log('Roles in DB:', allRoles);

  const testCust = await db.select().from(users).where(sql`email LIKE '%e2e_cust_%'`);
  console.log('Test customers in DB:', testCust);

  const testProfiles = await db.select().from(customerProfiles);
  console.log('Customer profiles count:', testProfiles.length);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
