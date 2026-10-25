import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './connection.js';
import { roles } from './schema/roles.js';

async function runMigrations() {
  console.log('Connecting to database and running setup...');
  try {
    // 1. Ensure PostGIS extension exists
    console.log('Ensuring PostGIS extension is installed...');
    await client.unsafe(`CREATE EXTENSION IF NOT EXISTS postgis;`);

    // 2. Run schema migrations
    console.log('Applying migrations from ./src/database/migrations...');
    await migrate(db, { migrationsFolder: './src/database/migrations' });
    console.log('Migrations applied successfully.');

    // 3. Seed default roles if not present
    await db.insert(roles).values([
      { id: 'CUSTOMER', description: 'Household customer requesting home services' },
      { id: 'WORKER', description: 'Service professional providing trades and repairs' },
      { id: 'ADMIN', description: 'Platform administrator with full compliance & operations access' },
      { id: 'SUPPORT', description: 'Customer and worker dispute arbitration support' },
    ]).onConflictDoNothing();
    console.log('Default platform roles verified.');

    // 4. Enforce Row Level Security (RLS) on all public tables
    console.log('Enforcing Row Level Security (RLS) on all public tables...');
    await client.unsafe(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        END LOOP;
      END $$;
    `);
    console.log('RLS enforced across all public schema tables.');
    console.log('All database migrations and security policies completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
