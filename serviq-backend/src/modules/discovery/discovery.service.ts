import { sql } from 'drizzle-orm';
import { inArray, eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { workerSkills } from '../../database/schema/worker-skills.js';
import { serviceCategories } from '../../database/schema/categories.js';
import { workerProfiles } from '../../database/schema/worker-profiles.js';
import { users } from '../../database/schema/users.js';
import { WorkerSearchQueryInput, NearbyWorkersQueryInput } from './discovery.schemas.js';
import { TooManyRequestsError } from '../../common/errors/app-error.js';

export function getStableJitter(workerId: string): { latOffset: number; lngOffset: number } {
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < workerId.length; i++) {
    hash1 = (hash1 * 31 + workerId.charCodeAt(i)) >>> 0;
    hash2 = (hash2 * 37 + workerId.charCodeAt(i)) >>> 0;
  }
  // Convert to offset in meters: ~150 to ~300 meters
  const angle = ((hash1 % 360) * Math.PI) / 180;
  const distMeters = 150 + (hash2 % 150); // 150 to 300 meters
  const latOffset = (distMeters * Math.cos(angle)) / 111000;
  const lngOffset = (distMeters * Math.sin(angle)) / (111000 * Math.cos(19.29 * (Math.PI / 180)));
  return { latOffset, lngOffset };
}

export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKERS_FILE_PATH = path.resolve(__dirname, '../../../data/mock-workers.json');

const DEFAULT_DEMO_WORKERS = [
  { id: 'demo-w-1', displayName: 'Ramesh Patil', skill: 'Plumbing', averageRating: 4.9, totalReviewsCount: 14, latitude: 19.298, longitude: 72.855, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-2', displayName: 'Suresh Kumar', skill: 'Electrical', averageRating: 4.8, totalReviewsCount: 19, latitude: 19.284, longitude: 72.868, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-3', displayName: 'Amit More', skill: 'Carpentry', averageRating: 4.7, totalReviewsCount: 11, latitude: 19.301, longitude: 72.862, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-4', displayName: 'Kavita Sharma', skill: 'Cleaning', averageRating: 4.9, totalReviewsCount: 22, latitude: 19.281, longitude: 72.859, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-5', displayName: 'Imran Shaikh', skill: 'AC repair', averageRating: 4.8, totalReviewsCount: 16, latitude: 19.255, longitude: 72.858, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-6', displayName: 'Rajesh Vishwakarma', skill: 'Painting', averageRating: 4.6, totalReviewsCount: 12, latitude: 19.205, longitude: 72.842, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-7', displayName: 'Sunita Gaikwad', skill: 'Cooking', averageRating: 5.0, totalReviewsCount: 15, latitude: 19.299, longitude: 72.852, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-8', displayName: 'Dinesh Chauhan', skill: 'Plumbing', averageRating: 4.8, totalReviewsCount: 9, latitude: 19.286, longitude: 72.871, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-9', displayName: 'Ganesh Shinde', skill: 'Electrical', averageRating: 4.7, totalReviewsCount: 17, latitude: 19.231, longitude: 72.856, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-10', displayName: 'Pooja Rawat', skill: 'Cleaning', averageRating: 4.9, totalReviewsCount: 8, latitude: 19.303, longitude: 72.864, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-11', displayName: 'Fahim Ansari', skill: 'AC repair', averageRating: 4.9, totalReviewsCount: 10, latitude: 19.292, longitude: 72.865, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-12', displayName: 'Manoj Suthar', skill: 'Carpentry', averageRating: 4.8, totalReviewsCount: 14, latitude: 19.297, longitude: 72.854, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-13', displayName: 'Geeta Nair', skill: 'Cooking', averageRating: 4.9, totalReviewsCount: 13, latitude: 19.285, longitude: 72.863, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-14', displayName: 'Vijay Kanojia', skill: 'Painting', averageRating: 4.7, totalReviewsCount: 7, latitude: 19.300, longitude: 72.859, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: 'demo-w-15', displayName: 'Anil Gupta', skill: 'Plumbing', averageRating: 4.8, totalReviewsCount: 18, latitude: 19.288, longitude: 72.869, isOnline: true, isVerified: true, status: 'ACTIVE' },
  { id: '5be7b904-138b-42cc-855b-a8cf1634d97f', displayName: 'Baddie', skill: 'AC repair', averageRating: 4.9, totalReviewsCount: 12, latitude: 19.29, longitude: 72.855, isOnline: true, isVerified: true, status: 'ACTIVE' },
];

function loadWorkersFromDisk(): any[] {
  try {
    if (fs.existsSync(WORKERS_FILE_PATH)) {
      const content = fs.readFileSync(WORKERS_FILE_PATH, 'utf-8');
      const list = JSON.parse(content);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    fs.mkdirSync(path.dirname(WORKERS_FILE_PATH), { recursive: true });
    fs.writeFileSync(WORKERS_FILE_PATH, JSON.stringify(DEFAULT_DEMO_WORKERS, null, 2), 'utf-8');
    return [...DEFAULT_DEMO_WORKERS];
  } catch (err) {
    return [...DEFAULT_DEMO_WORKERS];
  }
}

function saveWorkersToDisk(workers: any[]) {
  try {
    fs.mkdirSync(path.dirname(WORKERS_FILE_PATH), { recursive: true });
    fs.writeFileSync(WORKERS_FILE_PATH, JSON.stringify(workers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save workers to disk:', err);
  }
}

export class DiscoveryService {
  private rateLimitTracker = new Map<string, number[]>();
  private fallbackWorkers = loadWorkersFromDisk();

  public checkRateLimit(key: string) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const timestamps = (this.rateLimitTracker.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= 30) {
      throw new TooManyRequestsError('Rate limit exceeded: max 30 requests per minute for nearby workers');
    }
    timestamps.push(now);
    this.rateLimitTracker.set(key, timestamps);
  }

  public resetRateLimit(key?: string) {
    if (key) {
      this.rateLimitTracker.delete(key);
    } else {
      this.rateLimitTracker.clear();
    }
  }

  public updateWorkerOnlineStatus(workerId: string, isOnline: boolean) {
    const w = this.fallbackWorkers.find((item) => item.id === workerId);
    if (w) {
      w.isOnline = isOnline;
      saveWorkersToDisk(this.fallbackWorkers);
    }
  }

  public updateWorkerLocation(workerId: string, lat: number, lng: number) {
    const w = this.fallbackWorkers.find((item) => item.id === workerId);
    if (w) {
      w.latitude = lat;
      w.longitude = lng;
      saveWorkersToDisk(this.fallbackWorkers);
    }
  }

  async getNearbyWorkers(input: NearbyWorkersQueryInput, rateLimitKey: string) {
    // 1. Enforce rate limit (30 req / min)
    this.checkRateLimit(rateLimitKey);

    const { lat, lng, radius_km, service_slug, north, south, east, west } = input;

    let rawWorkers: any[] = [];

    // Attempt DB query with fast 300ms race timeout
    try {
      const dbPromise = db
        .select({
          id: workerProfiles.id,
          displayName: workerProfiles.displayName,
          avatarUrl: workerProfiles.avatarUrl,
          skill: workerProfiles.skill,
          averageRating: workerProfiles.averageRating,
          totalReviewsCount: workerProfiles.totalReviewsCount,
          isVerified: workerProfiles.isVerified,
          isOnline: workerProfiles.isOnline,
          latitude: workerProfiles.latitude,
          longitude: workerProfiles.longitude,
          userStatus: users.status,
        })
        .from(workerProfiles)
        .innerJoin(users, eq(users.id, workerProfiles.id))
        .where(
          sql`${workerProfiles.isOnline} = true AND ${workerProfiles.isVerified} = true AND ${users.status} = 'ACTIVE' AND ${workerProfiles.latitude} IS NOT NULL AND ${workerProfiles.longitude} IS NOT NULL`
        );

      const dbWorkers: any = await Promise.race([
        dbPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 3500)),
      ]);

      if (dbWorkers && dbWorkers.length > 0) {
        rawWorkers = dbWorkers.map((w: any) => ({
          id: w.id,
          displayName: w.displayName,
          avatarUrl: w.avatarUrl,
          skill: w.skill || 'Home Services',
          averageRating: w.averageRating ? Number(w.averageRating) : null,
          totalReviewsCount: w.totalReviewsCount || 0,
          isVerified: Boolean(w.isVerified),
          isOnline: Boolean(w.isOnline),
          latitude: Number(w.latitude),
          longitude: Number(w.longitude),
        }));
      }
    } catch {
      // Fallback to resilient disk-backed workers
    }

    if (rawWorkers.length === 0) {
      rawWorkers = this.fallbackWorkers
        .filter((w) => w.isOnline && w.status === 'ACTIVE')
        .map((w) => ({
          ...w,
          avatarUrl: null,
        }));
    }

    // 2. Filter by service slug if specified (and not 'all')
    const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetSlug = service_slug ? norm(service_slug) : '';

    const filtered = rawWorkers.filter((w) => {
      // Online check
      if (!w.isOnline) return false;

      // Category check
      if (targetSlug && targetSlug !== 'all') {
        const workerSkillNorm = norm(w.skill);
        if (!workerSkillNorm.includes(targetSlug) && !targetSlug.includes(workerSkillNorm)) {
          return false;
        }
      }

      // Distance check
      const dist = calculateHaversineKm(lat, lng, w.latitude, w.longitude);
      if (dist > radius_km) return false;

      // Bounds check if present
      if (north != null && south != null && east != null && west != null) {
        if (
          w.latitude < south ||
          w.latitude > north ||
          w.longitude < west ||
          w.longitude > east
        ) {
          // Keep eligible workers within the configured circular service radius
          return false;
        }
      }

      return true;
    });

    // 3. Format and strip all private data; apply stable coordinate jittering
    const results = filtered.map((w) => {
      const distKm = calculateHaversineKm(lat, lng, w.latitude, w.longitude);
      const { latOffset, lngOffset } = getStableJitter(w.id);

      // Snap / jitter coordinates stably by ~150 to ~300 meters
      const approxLat = Number((w.latitude + latOffset).toFixed(5));
      const approxLng = Number((w.longitude + lngOffset).toFixed(5));

      const parts = (w.displayName || 'Professional').trim().split(/\s+/);
      const firstName = parts[0] || 'Professional';
      const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0].toUpperCase()}.` : '';

      return {
        id: w.id,
        firstName,
        lastInitial,
        avatarUrl: w.avatarUrl || null,
        skill: w.skill || 'Home Services',
        avgRating: w.averageRating ? Number(w.averageRating) : null,
        reviewCount: Number(w.totalReviewsCount || 0),
        isVerified: Boolean(w.isVerified),
        distanceKm: Number(distKm.toFixed(1)),
        lat: approxLat,
        lng: approxLng,
      };
    });

    // Sort by distance ascending and limit to 100 markers
    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results.slice(0, 100);
  }

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

    try {
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
      const workers = workersResult as unknown as any[];

      // 3. Batch fetch skills for returned workers
      const workerIds = workers.map((w: any) => w.id);
      let skillsByWorker: Record<string, any[]> = {};

      if (workerIds.length > 0) {
        const skillsList = await db
          .select({
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
    } catch {
      // Fallback
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
  }
}

export const discoveryService = new DiscoveryService();
