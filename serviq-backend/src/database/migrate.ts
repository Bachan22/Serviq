import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './connection.js';
import { roles } from './schema/roles.js';

async function runMigrations() {
  console.log('Running database migrations...');
  try {
    await migrate(db, { migrationsFolder: './src/database/migrations' });
    console.log('Migrations applied successfully.');

    // Seed default roles if not present
    await db.insert(roles).values([
      { id: 'CUSTOMER', description: 'Household customer requesting home services' },
      { id: 'WORKER', description: 'Service professional providing trades and repairs' },
      { id: 'ADMIN', description: 'Platform administrator with full compliance & operations access' },
      { id: 'SUPPORT', description: 'Customer and worker dispute arbitration support' },
    ]).onConflictDoNothing();

    console.log('Default platform roles verified.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
