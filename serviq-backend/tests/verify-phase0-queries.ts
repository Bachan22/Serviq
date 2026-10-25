import { db, client } from '../src/database/connection.js';
import { workerProfiles, bookings, users } from '../src/database/schema/index.js';
import { eq, sql } from 'drizzle-orm';

async function testPostGISAndQueries() {
  console.log('Testing PostGIS queries on Supabase...');

  // 1. PostGIS distance calculation test
  const postgisCheck = await client`
    SELECT ST_Distance(
      ST_SetSRID(ST_MakePoint(72.855, 19.298), 4326)::geography,
      ST_SetSRID(ST_MakePoint(72.868, 19.284), 4326)::geography
    ) AS distance_meters;
  `;
  console.log('[PostGIS] Distance test meters:', postgisCheck[0]?.distance_meters);

  // 2. Query nearby workers using spatial index
  const lat = 19.298;
  const lng = 72.855;
  const radiusKm = 10;
  const nearbyWorkers = await client`
    SELECT wp.id, wp.display_name, wp.skill, wp.hourly_rate,
      ROUND(
        (ST_Distance(
          ST_SetSRID(ST_MakePoint(wp.longitude, wp.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) / 1000)::numeric, 2
      ) AS distance_km
    FROM worker_profiles wp
    WHERE wp.is_online = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(wp.longitude, wp.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusKm * 1000}
      )
    ORDER BY distance_km ASC;
  `;
  console.log(`[Discovery] Found ${nearbyWorkers.length} nearby workers within ${radiusKm}km via PostGIS ST_DWithin:`);
  nearbyWorkers.slice(0, 5).forEach((w: any) => console.log(`  - ${w.display_name} (${w.skill}) at ${w.distance_km} km`));

  // 3. Test get_matching_jobs function
  const acWorker = await db.query.workerProfiles.findFirst({
    where: eq(workerProfiles.skill, 'AC repair'),
  });

  if (acWorker) {
    const matchingJobs = await client`
      SELECT * FROM get_matching_jobs(${acWorker.id}::uuid);
    `;
    console.log(`[Broadcast Matching] get_matching_jobs returned ${matchingJobs.length} eligible jobs for worker ${acWorker.displayName}:`);
    matchingJobs.forEach((j: any) => console.log(`  - Job: ${j.title} | Budget: ₹${j.budget} | Dist: ${j.distance_km}km`));
  }

  console.log('\n[PASS] All PostGIS queries and matching functions executed successfully on Supabase.');
  await client.end();
}

testPostGISAndQueries().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
