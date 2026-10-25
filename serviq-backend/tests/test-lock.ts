import 'dotenv/config';
import { db } from '../src/database/connection.js';
import { bookings } from '../src/database/schema/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const [b] = await db.select().from(bookings).limit(1);
  console.log('Testing lock query on booking ID:', b?.id);
  if (!b) return;

  const result = await db.transaction(async (tx) => {
    const lockQuery = sql`
      SELECT *
      FROM bookings
      WHERE id = ${b.id}::uuid
      FOR UPDATE
    `;
    const lockRes = await tx.execute<any>(lockQuery);
    console.log('Lock res type:', Array.isArray(lockRes), 'length:', lockRes.length);
    console.log('First row:', lockRes[0]);
    return lockRes[0];
  });

  console.log('Transaction completed successfully:', result?.id);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
