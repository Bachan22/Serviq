# SERVIQ — Phase 2 Implementation Report: Booking Engine, Negotiation & Dispatch

**Status:** Completed & Validated  
**Database:** PostgreSQL 18 + PostGIS 3.6  
**Test Suite Results:** 52 / 52 tests passing (100% pass rate across 3 test suites)  
**TypeScript Build:** Clean (0 errors)

---

## 1. Executive Summary

Phase 2 builds upon the catalog and hyperlocal discovery foundation of Phase 1, introducing the transactional marketplace core:

1. **Dual Dispatch System:** Supports both **Direct Booking** (customer directly selects an eligible worker) and **Hyperlocal Broadcast Dispatch** (customer requests nearby verified workers via PostGIS `ST_DWithin` radius matching).
2. **Concurrency Protection with Pessimistic Row Locking:** Prevents race conditions during broadcast claims using PostgreSQL `SELECT FOR UPDATE`. The first worker to claim transitions the booking to `ACCEPTED`, while concurrent claims receive a clean `409 Conflict` (`BOOKING_ALREADY_CLAIMED`).
3. **On-Site Negotiation Engine:** Structured price discovery supporting itemized labor and parts. Enforces business rules:
   - **Bounded Rounds:** Maximum 2 rounds per party (`MAX_NEGOTIATION_ROUNDS = 2`).
   - **Active Offer Expiry:** 15-minute offer validity (`OFFER_EXPIRY_MINS = 15`) evaluated at query time.
   - Agreement transitions the job to `IN_PROGRESS` with locked prices.
4. **Cancellation & Trip Fee Policy:**
   - 100% free cancellation during initial state (`PENDING_ACCEPTANCE`, `BROADCASTING`) or within the 5-minute grace window.
   - Post-arrival/dispatch cancellation fee: ₹100 default trip fee (85% worker compensation, 15% platform fee).
   - In-progress protection: Work already underway cannot be unilaterally cancelled by customers without dispute resolution.
5. **Auditing & Status History:** Every lifecycle transition is recorded in `booking_status_history` with actor ID and reason.

---

## 2. Database Schema & Migration Changes

Migration `0002_material_anthem.sql` established 4 new tables and 5 indexes:

### 2.1 Tables
- **`bookings`**: `id` (UUID PK), `booking_number` (unique human-readable string), `customer_id` (FK -> `customer_profiles`), `worker_id` (FK -> `worker_profiles`, nullable for broadcast), `category_id`, `address_id`, address snapshots (`service_address_text`, `service_latitude`, `service_longitude`), `status`, `dispatch_type`, `scheduled_for`, `customer_notes`, `problem_images`, `agreed_labor_price`, `agreed_parts_price`, `final_total_price`, `payment_method`, `payment_status`, `cancellation_trip_fee`, `worker_cancellation_share`, `platform_cancellation_fee`, timestamps (`dispatched_at`, `arrived_at`, `started_at`, `completed_at`, `cancelled_at`).
- **`booking_broadcasts`**: `id` (UUID PK), `booking_id` (FK -> `bookings`), `worker_id` (FK -> `worker_profiles`), `status` (`SENT`, `CLAIMED`, `DECLINED`, `EXPIRED`), `sent_at`, `responded_at`.
- **`negotiation_rounds`**: `id` (UUID PK), `booking_id` (FK -> `bookings`), `sender_id`, `sender_role` (`CUSTOMER`, `WORKER`), `round_number`, `proposed_labor_price`, `proposed_parts_price`, `itemized_labor_details`, `itemized_parts_details`, `status` (`PENDING`, `ACCEPTED`, `COUNTERED`, `REJECTED`, `EXPIRED`), `expires_at`, `responded_at`, `created_at`.
- **`booking_status_history`**: `id` (UUID PK), `booking_id` (FK -> `bookings`), `from_status`, `to_status`, `changed_by`, `change_reason`, `created_at`.

### 2.2 Performance Indexes
- `idx_bookings_customer`: `(customer_id, status)`
- `idx_bookings_worker`: `(worker_id, status)`
- `idx_bookings_status`: `(status)`
- `idx_booking_broadcasts_worker`: `(worker_id, status)`
- `idx_negotiation_rounds_booking`: `(booking_id, round_number)`

---

## 3. API Endpoints Reference

### 3.1 Booking & Dispatch (`/api/v1/bookings`)
- `POST /api/v1/bookings/direct` — Customer creates direct booking.
- `POST /api/v1/bookings/broadcast` — Customer broadcasts job request to nearby verified workers.
- `GET /api/v1/bookings/broadcasts/available` — Worker views available broadcast jobs.
- `POST /api/v1/bookings/:id/claim` — Worker claims broadcast booking (`FOR UPDATE` concurrency safe).
- `PATCH /api/v1/bookings/:id/respond` — Worker accepts or declines direct booking.
- `PATCH /api/v1/bookings/:id/status` — Worker updates lifecycle status (`ARRIVED`, `IN_PROGRESS`, `COMPLETED`).
- `PATCH /api/v1/bookings/:id/cancel` — Cancels booking with automatic trip fee calculation.
- `GET /api/v1/bookings` — Lists bookings for authenticated user (paginated).
- `GET /api/v1/bookings/:id` — Detailed booking info with timeline, address snapshot, and audit trail.

### 3.2 On-Site Negotiation (`/api/v1/bookings/:id`)
- `POST /api/v1/bookings/:id/estimate` — Worker submits price estimate (labor + parts). Maximum 2 rounds per party.
- `POST /api/v1/bookings/:id/respond` — Customer responds (`ACCEPT`, `COUNTER`, `REJECT`).
- `GET /api/v1/bookings/:id/negotiation` — Retrieves negotiation round history.

---

## 4. Automated Test Suite Results

All 52 tests run against real PostgreSQL 18 + PostGIS 3.6:

```
> vitest run

 ✓ tests/auth.test.ts (9 tests) 60ms
 ✓ tests/booking-negotiation.test.ts (16 tests) 309ms
 ✓ tests/catalog-discovery.test.ts (27 tests) 451ms

 Test Files  3 passed (3)
      Tests  52 passed (52)
   Duration  2.22s
```

### Verified Test Cases:
1. **Direct Booking Flow:** Creation, acceptance by assigned worker, arrival transition, and rejection of non-assigned worker attempts.
2. **Broadcast Dispatch Flow:** Finding nearby workers via PostGIS `ST_DWithin`, broadcast feed delivery, and claiming.
3. **Pessimistic Locking Concurrency:** Worker 1 claims broadcast booking; Worker 2 attempting to claim the same booking gets 409 Conflict (`BOOKING_ALREADY_CLAIMED`).
4. **Negotiation Round Limits:** Worker submits Round 1; Customer counters; Worker submits Round 2; Worker attempting Round 3 is blocked with 400 Bad Request.
5. **Agreement & Pricing:** Customer acceptance transitions booking to `IN_PROGRESS` with locked prices and timestamp.
6. **Job Completion:** Worker marks `COMPLETED`; payment status flips to `PAID`, and worker's `completedJobsCount` increments.
7. **Free Cancellation:** Customer cancels in `PENDING_ACCEPTANCE` -> ₹0 fee.
8. **Trip Fee Policy:** Customer cancels after arrival beyond grace period -> ₹100 charged (₹85 worker share, ₹15 platform share).

---

## 5. Frontend Client Modules

Reusable client methods added to `serviq-frontend/serviq-frontend/src/api/`:
- [`booking.js`](file:///c:/Users/Gurubachan%20Singh/Downloads/serviq-frontend/serviq-frontend/src/api/booking.js): Direct/broadcast creation, available broadcast listing, claiming, status progression, cancellation.
- [`negotiation.js`](file:///c:/Users/Gurubachan%20Singh/Downloads/serviq-frontend/serviq-frontend/src/api/negotiation.js): Estimate submission, customer response (accept/counter/reject), negotiation history.
- [`index.js`](file:///c:/Users/Gurubachan%20Singh/Downloads/serviq-frontend/serviq-frontend/src/api/index.js): Centralized export for all domain APIs.

---

## 6. Project Status & Next Steps

Phase 0, Phase 1, and Phase 2 are complete, tested, and documented.
The next logical milestone is **Phase 3: Payments, Wallet & Settlements** (Razorpay UPI integration, worker wallet credit limits for COD, commission deductions, and payouts).
