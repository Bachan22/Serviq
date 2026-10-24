-- Migration 0005: Clean Dynamic Schema & Job Matching Function

-- 1. Ensure saved_workers table exists
CREATE TABLE IF NOT EXISTS "saved_workers" (
  "customer_id" uuid NOT NULL REFERENCES "customer_profiles"("id") ON DELETE CASCADE,
  "worker_id" uuid NOT NULL REFERENCES "worker_profiles"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "saved_workers_pkey" PRIMARY KEY ("customer_id", "worker_id")
);

-- 2. Ensure job_offers table exists
CREATE TABLE IF NOT EXISTS "job_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "worker_id" uuid NOT NULL REFERENCES "worker_profiles"("id") ON DELETE CASCADE,
  "price" numeric(10, 2) NOT NULL,
  "kind" varchar(20) NOT NULL, -- 'accept', 'counter'
  "status" varchar(20) DEFAULT 'pending' NOT NULL, -- 'pending', 'accepted', 'rejected', 'withdrawn'
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Add is_demo and required dynamic columns if they do not exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "area" text;
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "longitude" double precision;

ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "skill" varchar(100);
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "secondary_skills" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10, 2) DEFAULT 350.00 NOT NULL;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "service_area" text;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "avg_response_seconds" integer;

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "title" varchar(255);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "budget" numeric(10, 2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "area" text;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "comment" text;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "idx_bookings_status" ON "bookings"("status");
CREATE INDEX IF NOT EXISTS "idx_bookings_worker" ON "bookings"("worker_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_customer" ON "bookings"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_reviews_worker" ON "reviews"("worker_id");
CREATE INDEX IF NOT EXISTS "idx_job_offers_job" ON "job_offers"("job_id");
CREATE INDEX IF NOT EXISTS "idx_job_offers_worker" ON "job_offers"("worker_id");

-- 5. SQL Matching Function: get_matching_jobs(worker_id)
-- Matches based on:
-- 1. Skill match: category name or slug matches worker's skill or secondary_skills
-- 2. Distance: within worker's service_radius_km using Haversine formula
-- 3. Status: open or bidding (PENDING_ACCEPTANCE) and not accepted by another worker
-- 4. Not declined by this worker
-- 5. Worker is online and not suspended
CREATE OR REPLACE FUNCTION get_matching_jobs(p_worker_id UUID)
RETURNS TABLE (
  id UUID,
  booking_number VARCHAR,
  title VARCHAR,
  category_name VARCHAR,
  customer_name VARCHAR,
  location TEXT,
  budget NUMERIC,
  status VARCHAR,
  time_ago TEXT,
  distance_km NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_worker RECORD;
BEGIN
  -- Get worker details
  SELECT wp.*, u.status AS user_status
  INTO v_worker
  FROM worker_profiles wp
  JOIN users u ON u.id = wp.id
  WHERE wp.id = p_worker_id;

  -- If worker not found, suspended, or offline, return empty
  IF NOT FOUND OR v_worker.user_status = 'SUSPENDED' OR NOT v_worker.is_online THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.booking_number,
    COALESCE(b.title, sc.name || ' service') AS title,
    sc.name AS category_name,
    COALESCE(cp.display_name, 'Customer') AS customer_name,
    COALESCE(b.area, b.service_address_text, 'Nearby') AS location,
    COALESCE(b.budget, b.agreed_labor_price, sc.typical_price_min, 400.00) AS budget,
    b.status,
    'Just now' AS time_ago,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_worker.latitude)) * cos(radians(b.service_latitude)) *
          cos(radians(b.service_longitude) - radians(v_worker.longitude)) +
          sin(radians(v_worker.latitude)) * sin(radians(b.service_latitude))
        ))
      ))::numeric, 1
    ) AS distance_km,
    b.created_at
  FROM bookings b
  JOIN service_categories sc ON sc.id = b.category_id
  JOIN customer_profiles cp ON cp.id = b.customer_id
  WHERE
    -- Rule 1: Skill Match
    (
      LOWER(sc.name) = LOWER(v_worker.skill)
      OR LOWER(sc.slug) = LOWER(v_worker.skill)
      OR (v_worker.secondary_skills IS NOT NULL AND v_worker.secondary_skills ? LOWER(sc.name))
    )
    -- Rule 2: Distance match within radius
    AND (
      v_worker.latitude IS NULL OR b.service_latitude IS NULL
      OR (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_worker.latitude)) * cos(radians(b.service_latitude)) *
          cos(radians(b.service_longitude) - radians(v_worker.longitude)) +
          sin(radians(v_worker.latitude)) * sin(radians(b.service_latitude))
        ))
      )) <= v_worker.service_radius_km
    )
    -- Rule 3: Job open / bidding
    AND b.status IN ('PENDING_ACCEPTANCE', 'open', 'bidding')
    AND (b.worker_id IS NULL OR b.worker_id = p_worker_id)
    -- Rule 4: Not withdrawn/rejected by this worker
    AND NOT EXISTS (
      SELECT 1 FROM job_offers jo
      WHERE jo.job_id = b.id AND jo.worker_id = p_worker_id AND jo.status IN ('rejected', 'withdrawn')
    )
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql;
