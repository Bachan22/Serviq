import { sql } from 'drizzle-orm';
import { inArray, eq } from 'drizzle-orm';
import { db } from '../../database/connection';
import { workerSkills } from '../../database/schema/worker-skills';
import { serviceCategories } from '../../database/schema/categories';
import { WorkerSearchQueryInput } from './discovery.schemas';

export class DiscoveryService {
  async searchWorkers(input: WorkerSearchQueryInput) {
    const {
      latitude,
      longitude,
      radiusKm,
      category,
      availableNow,
      minRating,
      maxPrice,
      sortBy,
      page,
      limit,
    } = input;

    const offset = (page - 1) * limit;
    const radiusMeters = radiusKm * 1000;

    // Build conditions dynamically using Drizzle sql template
    const conditions = [
      sql`u.status = 'ACTIVE'`,
      sql`w.is_verified = true`,
      sql`w.verification_status = 'APPROVED'`,
      sql`w.latitude IS NOT NULL`,
      sql`w.longitude IS NOT NULL`,
      // Spatial containment: within customer search radius AND within worker service radius
      sql`ST_DWithin(
        ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        LEAST(${radiusMeters}, (w.service_radius_km * 1000)::double precision)
      )`,
    ];

    if (availableNow) {
      conditions.push(sql`w.is_online = true`);
      // Exclude stale locations older than 24h
      conditions.push(
        sql`(w.last_location_updated_at IS NULL OR w.last_location_updated_at >= NOW() - INTERVAL '24 hours')`
      );
    }

    if (category) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM worker_skills ws
        JOIN service_categories sc ON sc.id = ws.category_id
        WHERE ws.worker_id = w.id
          AND sc.is_active = true
          AND (sc.slug = ${category} OR sc.id::text = ${category})
      )`);
    }

    if (minRating !== undefined && minRating > 0) {
      conditions.push(sql`w.average_rating >= ${minRating}`);
    }

    if (maxPrice !== undefined && maxPrice > 0) {
      conditions.push(sql`w.base_visiting_fee <= ${maxPrice}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // Sorting definition
    let orderClause = sql`"distanceKm" ASC, w.average_rating DESC, w.id ASC`;
    if (sortBy === 'rating') {
      orderClause = sql`w.average_rating DESC, "distanceKm" ASC, w.id ASC`;
    } else if (sortBy === 'price_asc') {
      orderClause = sql`w.base_visiting_fee ASC, "distanceKm" ASC, w.id ASC`;
    } else if (sortBy === 'experience') {
      orderClause = sql`w.experience_years DESC, "distanceKm" ASC, w.id ASC`;
    }

    // 1. Total count query
    const countQuery = sql`
      SELECT COUNT(*)::int AS count
      FROM worker_profiles w
      JOIN users u ON u.id = w.id
      WHERE ${whereClause}
    `;

    const countResult = await db.execute<{ count: number }>(countQuery);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) {
      return {
        workers: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    // 2. Data query
    const searchQuery = sql`
      SELECT
        w.id,
        w.display_name AS "displayName",
        w.bio,
        w.avatar_url AS "avatarUrl",
        w.experience_years::float AS "experienceYears",
        w.is_verified AS "isVerified",
        w.is_online AS "isOnline",
        w.service_radius_km::float AS "serviceRadiusKm",
        w.base_visiting_fee::float AS "baseVisitingFee",
        w.working_hours AS "workingHours",
        w.average_rating::float AS "averageRating",
        w.total_reviews_count AS "totalReviewsCount",
        w.completed_jobs_count AS "completedJobsCount",
        ROUND((ST_Distance(
          ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        ) / 1000.0)::numeric, 1)::float AS "distanceKm"
      FROM worker_profiles w
      JOIN users u ON u.id = w.id
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const workersResult = await db.execute<any>(searchQuery);
    const workers = (workersResult as unknown as any[]);

    // 3. Batch fetch skills for returned workers
    const workerIds = workers.map((w: any) => w.id);
    let skillsByWorker: Record<string, any[]> = {};

    if (workerIds.length > 0) {
      const skillsList = await db.select({
        workerId: workerSkills.workerId,
        categoryId: serviceCategories.id,
        categoryName: serviceCategories.name,
        categorySlug: serviceCategories.slug,
        iconKey: serviceCategories.iconKey,
        experienceMonths: workerSkills.experienceMonths,
      })
        .from(workerSkills)
        .innerJoin(serviceCategories, eq(workerSkills.categoryId, serviceCategories.id))
        .where(inArray(workerSkills.workerId, workerIds));

      skillsByWorker = skillsList.reduce((acc: Record<string, any[]>, skill) => {
        if (!acc[skill.workerId]) acc[skill.workerId] = [];
        acc[skill.workerId].push({
          categoryId: skill.categoryId,
          categoryName: skill.categoryName,
          categorySlug: skill.categorySlug,
          iconKey: skill.iconKey,
          experienceMonths: skill.experienceMonths,
        });
        return acc;
      }, {});
    }

    const enrichedWorkers = workers.map((w: any) => ({
      ...w,
      skills: skillsByWorker[w.id] || [],
    }));

    return {
      workers: enrichedWorkers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const discoveryService = new DiscoveryService();
