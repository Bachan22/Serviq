CREATE TABLE IF NOT EXISTS "booking_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'SENT' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" varchar(50),
	"to_status" varchar(50) NOT NULL,
	"changed_by" uuid NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_number" varchar(50) NOT NULL,
	"customer_id" uuid NOT NULL,
	"worker_id" uuid,
	"category_id" uuid NOT NULL,
	"address_id" uuid,
	"service_address_text" text NOT NULL,
	"service_latitude" double precision NOT NULL,
	"service_longitude" double precision NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING_ACCEPTANCE' NOT NULL,
	"dispatch_type" varchar(20) DEFAULT 'DIRECT' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"customer_notes" text,
	"audio_note_url" text,
	"problem_images" jsonb DEFAULT '[]'::jsonb,
	"agreed_labor_price" numeric(10, 2),
	"agreed_parts_price" numeric(10, 2) DEFAULT '0.00',
	"final_total_price" numeric(10, 2),
	"payment_method" varchar(30) DEFAULT 'CASH_ON_DELIVERY',
	"payment_status" varchar(30) DEFAULT 'PENDING',
	"cancellation_reason" text,
	"cancelled_by" varchar(30),
	"cancellation_trip_fee" numeric(10, 2) DEFAULT '0.00',
	"worker_cancellation_share" numeric(10, 2) DEFAULT '0.00',
	"platform_cancellation_fee" numeric(10, 2) DEFAULT '0.00',
	"dispatched_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "bookings_booking_number_unique" UNIQUE("booking_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "negotiation_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_role" varchar(20) NOT NULL,
	"round_number" integer NOT NULL,
	"proposed_labor_price" numeric(10, 2) NOT NULL,
	"proposed_parts_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"itemized_labor_details" text,
	"itemized_parts_details" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_broadcasts" ADD CONSTRAINT "booking_broadcasts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_broadcasts" ADD CONSTRAINT "booking_broadcasts_worker_id_worker_profiles_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_worker_id_worker_profiles_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "negotiation_rounds" ADD CONSTRAINT "negotiation_rounds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "negotiation_rounds" ADD CONSTRAINT "negotiation_rounds_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_customer" ON "bookings" ("customer_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_worker" ON "bookings" ("worker_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_status" ON "bookings" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_broadcasts_worker" ON "booking_broadcasts" ("worker_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_negotiation_rounds_booking" ON "negotiation_rounds" ("booking_id", "round_number");
