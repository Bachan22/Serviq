-- Migration 0006: Chat, Notifications, Lifecycle status columns & RLS Security

-- 1. Ensure conversations table exists
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
  "customer_id" uuid NOT NULL REFERENCES "customer_profiles"("id") ON DELETE CASCADE,
  "worker_id" uuid NOT NULL REFERENCES "worker_profiles"("id") ON DELETE CASCADE,
  "last_message_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_conversations_customer" ON "conversations"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_worker" ON "conversations"("worker_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_booking" ON "conversations"("booking_id");

-- 2. Ensure messages table exists
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "sender_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sender_role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_messages_conversation" ON "messages"("conversation_id", "created_at");

-- 3. Ensure service_issues table exists
CREATE TABLE IF NOT EXISTS "service_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "category_id" uuid NOT NULL REFERENCES "service_categories"("id") ON DELETE CASCADE,
  "label" varchar(150) NOT NULL,
  "description" text,
  "typical_price" numeric(10, 2),
  "is_common" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_service_issues_category" ON "service_issues"("category_id");

-- 4. Ensure notifications table exists
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "type" varchar(50) NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "metadata" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("user_id", "created_at" DESC);

-- 5. Add lifecycle and verification columns to bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "on_the_way_at" timestamp with time zone;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customer_confirmed_at" timestamp with time zone;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "start_code_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "start_code_locked_until" timestamp with time zone;

-- 6. Enable Row Level Security (RLS) on all public tables, with NO public/anon policies
-- This prevents the auto-generated Supabase PostgREST API with anon key from reading/writing data
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
