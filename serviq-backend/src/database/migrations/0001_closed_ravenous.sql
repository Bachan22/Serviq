CREATE TABLE IF NOT EXISTS "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_label" varchar(50) NOT NULL,
	"recipient_name" varchar(100),
	"recipient_phone" varchar(20),
	"address_line_1" varchar(255) NOT NULL,
	"address_line_2" varchar(255),
	"locality" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) DEFAULT 'Maharashtra' NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"icon_key" varchar(50) NOT NULL,
	"parent_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"typical_price_min" numeric(10, 2),
	"typical_price_max" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "service_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"bio" text,
	"avatar_url" text,
	"emergency_phone" varchar(20),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"bio" text,
	"avatar_url" text,
	"experience_years" numeric(3, 1) DEFAULT '1.0' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_status" varchar(30) DEFAULT 'UNVERIFIED' NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"service_radius_km" numeric(4, 1) DEFAULT '10.0' NOT NULL,
	"base_visiting_fee" numeric(10, 2) DEFAULT '250.00' NOT NULL,
	"working_hours" jsonb DEFAULT '{"monday":{"start":"09:00","end":"18:00"},"tuesday":{"start":"09:00","end":"18:00"},"wednesday":{"start":"09:00","end":"18:00"},"thursday":{"start":"09:00","end":"18:00"},"friday":{"start":"09:00","end":"18:00"},"saturday":{"start":"09:00","end":"18:00"},"sunday":{"start":"10:00","end":"16:00"}}'::jsonb,
	"latitude" double precision,
	"longitude" double precision,
	"last_location_updated_at" timestamp with time zone,
	"average_rating" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"total_reviews_count" integer DEFAULT 0 NOT NULL,
	"completed_jobs_count" integer DEFAULT 0 NOT NULL,
	"profile_completeness_pct" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_skills" (
	"worker_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"experience_months" integer DEFAULT 12 NOT NULL,
	CONSTRAINT "worker_skills_worker_id_category_id_pk" PRIMARY KEY("worker_id","category_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_skills" ADD CONSTRAINT "worker_skills_worker_id_worker_profiles_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_skills" ADD CONSTRAINT "worker_skills_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_worker_profiles_geo" ON "worker_profiles" USING GIST (
  (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addresses_geo" ON "addresses" USING GIST (
  (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_customer_default_address" ON "addresses" ("customer_id") WHERE is_default = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_categories_active" ON "service_categories" ("is_active", "display_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_worker_profiles_search" ON "worker_profiles" ("is_online", "is_verified", "verification_status");

