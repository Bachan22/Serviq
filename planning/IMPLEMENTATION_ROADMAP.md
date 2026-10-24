# SERVIQ — Phased Implementation Roadmap

**Document Version:** 1.0.0  
**Target Completion:** Production-Ready MVP & Scalable Hyperlocal Marketplace  

---

## 1. Roadmap Overview & Phased Dependencies

The backend implementation is partitioned into eight sequential, test-driven phases. Each phase builds upon verified artifacts from earlier phases:

```
[Phase 0: Base Infra & Auth]
             │
             ▼
[Phase 1: Catalog & Discovery]
             │
             ▼
[Phase 2: Booking & Negotiation Engine] ─── (Critical Concurrency & Lock Engine)
             │
             ▼
[Phase 3: Real-Time Chat & Execution] ───── (Socket.io & Lifecycle Transitions)
             │
             ▼
[Phase 4: Financials & Ledger] ──────────── (Double-Entry Ledger & Gateway)
             │
             ▼
[Phase 5: Reviews & KYC Verification]
             │
             ▼
[Phase 6: Admin Operations & Audit]
             │
             ▼
[Phase 7: Frontend Integration & QA]
```

---

## 2. Phase-by-Phase Delivery Breakdown

### Phase 0: Base Infrastructure, Database & Authentication
- **Objective:** Establish the development environment, database schema migrations, and secure authentication layer.
- **Deliverables:**
  - Fastify server scaffolding with TypeScript, Pino logging, and Zod validation plugins.
  - PostgreSQL 16 + PostGIS Docker setup and Drizzle ORM configuration.
  - Initial database migration: `users`, `roles`, `user_roles`.
  - Phone OTP authentication service with Redis rate limiting and token bucket.
  - JWT issuance, refresh token rotation in HttpOnly cookies, and RBAC middleware.
- **Dependencies:** None.

### Phase 1: Catalog Taxonomy, Profiles & Hyperlocal Discovery
- **Objective:** Support customer/worker profiles, saved addresses, and geospatial discovery.
- **Deliverables:**
  - Database migration: `customer_profiles`, `worker_profiles`, `service_categories`, `services`, `worker_skills`, `addresses`, `worker_service_areas`.
  - Service category endpoints with provider counts.
  - Customer profile and multiple saved address CRUD (with default address toggle constraint).
  - Hyperlocal worker discovery endpoint (`GET /api/v1/workers/search`) using PostGIS `ST_DWithin` radius matching and sorting.
  - Worker availability toggle endpoint (`PATCH /api/v1/workers/availability`).
- **Dependencies:** Phase 0.

### Phase 2: Booking Engine & Bounded Price Negotiation
- **Objective:** Implement the core marketplace transaction engine with concurrency protection.
- **Deliverables:**
  - Database migration: `bookings`, `job_offers`, `booking_status_history`.
  - Booking creation endpoint (`POST /api/v1/bookings`) supporting Direct and Broadcast dispatch.
  - Bounded negotiation counter-offer endpoints (`POST /api/v1/bookings/:id/offers`).
  - Atomic offer acceptance transaction with PostgreSQL row-level locks (`SELECT FOR UPDATE`), automatically invalidating competing offers and assigning the worker.
  - BullMQ background jobs for 15-minute offer expiration timers.
- **Dependencies:** Phase 1.

### Phase 3: Active Job Execution, Real-Time Messaging & Notifications
- **Objective:** Enable in-app chat, lifecycle transitions, and instant push updates.
- **Deliverables:**
  - Database migration: `conversations`, `messages`, `notifications`.
  - Socket.io integration with Redis Pub/Sub adapter for real-time room communication (`booking:<id>`).
  - Bidirectional 1-to-1 chat endpoints and real-time socket events.
  - Booking lifecycle transition endpoints (`PATCH /api/v1/bookings/:id/status`) enforcing actor permissions and Customer Start OTP.
  - In-app notification center and SMS/Web Push dispatch triggers.
- **Dependencies:** Phase 2.

### Phase 4: Financials, Invoicing, Earnings & Settlements
- **Objective:** Build the immutable double-entry ledger, gateway checkout, and worker earnings.
- **Deliverables:**
  - Database migration: `payments`, `worker_earnings_ledger`, `settlements`.
  - Payment gateway integration (Razorpay / Stripe) with cryptographic webhook signature verification and idempotency protection.
  - Double-entry ledger calculating Gross Service Amount, Platform Commission, and Net Worker Earning.
  - Worker Dashboard real-time metrics API (`GET /api/v1/workers/dashboard`) calculating Today's Earnings, Weekly Chart, and Completed Jobs.
  - Worker settlement payout batch processing.
- **Dependencies:** Phase 3.

### Phase 5: Reviews, Reputation & Worker KYC Verification
- **Objective:** Build trust, quality feedback, and administrative worker verification.
- **Deliverables:**
  - Database migration: `reviews`, `worker_verification_documents`.
  - Customer review submission endpoint with verified completed booking check and 1-review-per-booking constraint.
  - Worker profile rating aggregation recalculation trigger.
  - Worker KYC document upload pipeline using S3 presigned URLs.
- **Dependencies:** Phase 4.

### Phase 6: Admin Operations, Dispute Arbitration & Audit
- **Objective:** Operational tooling for dispute management, KYC reviews, and platform audit.
- **Deliverables:**
  - Database migration: `audit_logs`, `admin_actions`.
  - Admin endpoints: KYC document review, worker suspension protocol, dispute resolution, refund processing.
  - Full audit logging middleware capturing actor, action, and diff.
- **Dependencies:** Phase 5.

### Phase 7: Frontend Integration, Hardening & Pre-Launch QA
- **Objective:** Wire the existing React + Vite frontend to live backend APIs, replacing all mock state.
- **Deliverables:**
  - Create `src/api/` client using Axios/Fetch with standard interceptors for JWT injection and auto-refresh.
  - Wire Customer flows: Address selection, live discovery search, real booking creation, live chat, tracking.
  - Wire Worker flows: Online toggle, real request feed, counter-offer modal submit, active job stepper, real dashboard metrics.
  - Implement loading skeletons, empty states, error banners with retry triggers, and mobile responsive validation.
  - Execute end-to-end Playwright tests across complete workflows.
- **Dependencies:** Phases 0 to 6.

---

## 3. Feature Classification & Governance Matrix

| Feature / Capability | Classification | Target Phase | Notes & Constraints |
| :--- | :--- | :--- | :--- |
| **Phone Number OTP Login** | **[CONFIRMED]** | Phase 0 | Primary consumer authentication method. |
| **JWT with HttpOnly Refresh Cookie** | **[PROPOSED]** | Phase 0 | Industry-standard XSS-resistant session management. |
| **Saved Addresses with Lat/Lng** | **[CONFIRMED]** | Phase 1 | Foundation for hyperlocal PostGIS radius matching. |
| **PostGIS Spatial Radius Search** | **[CONFIRMED]** | Phase 1 | Sub-millisecond worker proximity queries. |
| **Direct Worker Booking** | **[CONFIRMED]** | Phase 2 | Customer books a specific worker directly. |
| **Broadcast Dispatch to Nearby Pool** | **[PROPOSED]** | Phase 2 | Instant broadcast to online workers within 10 km. |
| **Bounded Counter-Offer Negotiation** | **[CONFIRMED]** | Phase 2 | Interactive price counter with 2-round cap. |
| **Atomic Lock (`SELECT FOR UPDATE`)** | **[CONFIRMED]** | Phase 2 | Eliminates double-claim race conditions. |
| **Offer 15-Minute Expiration Timers** | **[CONFIRMED]** | Phase 2 | Auto-expires unaccepted offers via BullMQ. |
| **Customer Start Safety OTP** | **[PROPOSED]** | Phase 3 | Customer gives 4-digit code to worker to start work. |
| **Socket.io Real-Time Chat** | **[CONFIRMED]** | Phase 3 | Scoped 1-to-1 messaging per booking. |
| **Double-Entry Earnings Ledger** | **[CONFIRMED]** | Phase 4 | Tracks gross, commission, net, and payouts. |
| **Payment Gateway Integration** | **[CONFIRMED]** | Phase 4 | Razorpay/Stripe with signature verification. |
| **Verified Customer Reviews Only** | **[CONFIRMED]** | Phase 5 | Strict 1 review per completed booking. |
| **Worker KYC Document Upload** | **[CONFIRMED]** | Phase 5 | Presigned S3 upload with admin approval gate. |
| **Admin Dispute Arbitration & Refund**| **[CONFIRMED]** | Phase 6 | Support workflow for contested bookings. |
| **Live Geolocation Tracking on Map** | **[FUTURE]** | Post-MVP | Uber-style live vehicle tracking while worker is on the way. |
| **In-App VoIP Voice Calling** | **[FUTURE]** | Post-MVP | Masked phone calling via Twilio/Exotel. |
| **Worker Subscription Tiers** | **[FUTURE]** | Post-MVP | Zero-commission monthly subscription option. |

---

## 4. Risk Assessment & Technical Mitigation Strategy

| Risk / Challenge | Likelihood | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Double-Claim Concurrency** | High | Critical | PostgreSQL pessimistic row locking (`SELECT FOR UPDATE`) within isolated database transaction. |
| **Flaky Mobile Connectivity** | High | High | Socket.io automatic fallback to HTTP polling; idempotent API requests (`Idempotency-Key`). |
| **Unresponsive Worker after Acceptance** | Medium | High | Automated no-show detection; 1-click customer reassignment to Broadcast Pool. |
| **Off-Platform Payment Disintermediation** | High | High | Value-added dispute protection, insurance coverage, and warranty valid only for on-platform transactions. |
| **Fake Worker Accounts & Fraud** | Medium | Critical | Mandatory KYC document upload with manual administrative verification before public profile activation. |
