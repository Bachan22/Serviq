# SERVIQ Backend — Architecture & Developer Guide

Hyperlocal on-demand blue-collar services marketplace backend API built with **Fastify, TypeScript, PostgreSQL (PostGIS), and Drizzle ORM**.

---

## 1. Prerequisites

- **Node.js:** v20+ LTS (Tested on v24.14.0)
- **Package Manager:** `npm` v10+
- **Database:** PostgreSQL 16+ with **PostGIS 3.4+** extension enabled
- **Cache:** Redis 7+ for OTP rate-limiting and session invalidation

---

## 2. Quick Start (Local Development)

### Step 1: Clone & Install Dependencies
```bash
cd serviq-backend
npm install
```

### Step 2: Configure Environment Variables
Copy the template and verify your database/port configuration:
```bash
cp .env.example .env
```

Ensure `DATABASE_URL` connects to a PostgreSQL instance with PostGIS installed:
```env
DATABASE_URL=postgresql://serviq_user:serviq_password@localhost:5432/serviq_dev
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
```

### Step 3: Run Database Migrations & Seeds
```bash
# Apply migrations (creates 11 tables, spatial GiST indexes, and seeds platform roles)
npm run db:migrate

# Seed service categories and subcategories (Plumbing, Electrical, Cleaning, etc.)
npm run db:seed
```

### Step 4: Start the Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:5000` (or configured `PORT`).

---

## 3. Running Automated Tests

Run the full automated test suite using Vitest (against real PostgreSQL + PostGIS):
```bash
npm test
```

To run in watch mode during development:
```bash
npm run test:watch
```

---

## 4. API Endpoints Reference

### Health & Configuration
- `GET /health` — Health check endpoint.
- `GET /api/v1/config/business-rules` — Configurable platform parameters (commission rate, cancellation fees, negotiation limits).

### Phase 0: Authentication & Sessions (`/api/v1/auth`)
- `POST /api/v1/auth/request-otp` — Request 6-digit phone OTP (`devOtp: "123456"` in development).
- `POST /api/v1/auth/verify-otp` — Verify OTP, register/login user, assign role (`CUSTOMER` or `WORKER`), issue 15-minute JWT access token and 30-day HttpOnly rotating refresh token cookie.
- `POST /api/v1/auth/refresh` — Rotate refresh token with token-family reuse detection defense.
- `POST /api/v1/auth/logout` — Revoke active refresh token session and clear cookie.
- `GET /api/v1/auth/me` — Protected endpoint returning authenticated user identity and roles.

### Phase 1: Service Catalog (`/api/v1/categories`)
- `GET /api/v1/categories` — List active categories and subcategories (excludes inactive categories for public customers).
- `GET /api/v1/categories?includeInactive=true` — Admin/audit view including inactive categories.
- `GET /api/v1/categories/:slug` — Retrieve single category details with child subcategories.
- `POST /api/v1/categories` — Create category (Requires `ADMIN` role).
- `PATCH /api/v1/categories/:id` — Update category status, display order, or details (Requires `ADMIN` role).

### Phase 1: Customer Profiles (`/api/v1/customers`)
- `GET /api/v1/customers/me` — Retrieve customer profile, phone number, and default address. Auto-creates profile on first visit.
- `PUT /api/v1/customers/me` — Update display name, bio, avatar, and emergency phone (Ownership enforced).

### Phase 1: Saved Addresses (`/api/v1/addresses`)
- `GET /api/v1/addresses` — List authenticated customer's saved addresses.
- `POST /api/v1/addresses` — Save new address with coordinate validation (-90 to 90 lat, -180 to 180 lon). First address automatically becomes default; setting `isDefault=true` atomically demotes previous default in a transaction.
- `PUT /api/v1/addresses/:id` — Update address fields.
- `DELETE /api/v1/addresses/:id` — Delete address.
- `PATCH /api/v1/addresses/:id/default` — Set an address as default.

### Phase 1: Worker Profiles & Availability (`/api/v1/workers`)
- `GET /api/v1/workers/me` — Full worker profile with contact details, verification status, and skills (Requires `WORKER` role).
- `PUT /api/v1/workers/me` — Update allowed fields (displayName, bio, avatarUrl, baseVisitingFee, serviceRadiusKm, workingHours). Identity verification status is protected and cannot be self-modified.
- `PATCH /api/v1/workers/availability` — Toggle `isOnline: boolean`.
- `PATCH /api/v1/workers/location` — Update worker real-time coordinates (`latitude`, `longitude`).
- `GET /api/v1/workers/skills` — List worker skills and category mappings.
- `POST /api/v1/workers/skills` — Add skill/category with experience months.
- `DELETE /api/v1/workers/skills/:categoryId` — Remove a skill.
- `GET /api/v1/workers/:id` — Public sanitized profile. Protects privacy by omitting phone numbers, email, and exact coordinates.
- `PATCH /api/v1/workers/:id/verification` — Approve or reject worker verification (Requires `ADMIN` role).

### Phase 1: Hyperlocal Worker Search (`GET /api/v1/workers/search`)
PostGIS spatial search calculating great-circle distance on WGS84 EPSG:4326 geography using GiST spatial indexing.

**Query Parameters:**
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `latitude` | `number` | Required | Search center latitude (-90 to 90) |
| `longitude`| `number` | Required | Search center longitude (-180 to 180) |
| `radiusKm` | `number` | `10` | Search radius in km (safe maximum 30 km) |
| `category` | `string` | Optional | Category slug or UUID |
| `availableNow` | `boolean` | `false` | If true, only workers online with fresh location (<24h) |
| `minRating`| `number` | Optional | Minimum average rating (e.g. 4.0) |
| `maxPrice` | `number` | Optional | Maximum base visiting fee |
| `sortBy` | `string` | `distance`| `distance`, `rating`, `price_asc`, `experience` |
| `page` | `number` | `1` | Pagination page number |
| `limit` | `number` | `10` | Items per page (max 50) |

**Spatial Rules Enforced:**
1. Only returns active, verified (`is_verified = true`, `verification_status = 'APPROVED'`) workers with valid coordinates.
2. Distance calculated via `ST_Distance` on `geography` type (meters converted to rounded km).
3. Evaluates worker's own `service_radius_km` so workers are only matched where customer is within their service territory.
4. Privacy protection: Omits worker exact coordinates, private phone, and email in public search responses.
5. Deterministic sorting with tie-breaker `w.id ASC`.

---

## 5. PostGIS Coordinate Reference System & Spatial Indexing

- **CRS:** WGS84 (`EPSG:4326`)
- **Spatial Storage:** PostGIS `geography` spherical type representing true ellipsoidal Earth distances.
- **Distance Unit:** Meters internally, exposed as kilometers (`distanceKm`) in API responses.
- **GiST Spatial Indexes:**
  - `idx_worker_profiles_geo` on `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`
  - `idx_addresses_geo` on `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`
- **Partial Unique Index:**
  - `uniq_customer_default_address` on `addresses (customer_id) WHERE is_default = true` guarantees data integrity for default addresses at the database level.

---

## 6. Phase 2: Booking Engine, Negotiation Flow & Dispatch

### Booking Endpoints (`/api/v1/bookings`)
- `POST /api/v1/bookings/direct` — Customer creates a direct booking with a specific worker.
- `POST /api/v1/bookings/broadcast` — Customer broadcasts job request to nearby verified workers within search radius.
- `GET /api/v1/bookings/broadcasts/available` — Worker views available broadcast jobs in their radius.
- `POST /api/v1/bookings/:id/claim` — Worker claims broadcast booking (protected by **pessimistic row locking** `SELECT FOR UPDATE` to prevent race conditions).
- `PATCH /api/v1/bookings/:id/respond` — Worker accepts or declines a direct booking.
- `PATCH /api/v1/bookings/:id/status` — Worker updates status (`ARRIVED`, `IN_PROGRESS`, `COMPLETED`).
- `PATCH /api/v1/bookings/:id/cancel` — Cancels booking with automatic trip fee calculation (₹100 trip fee beyond 5-minute grace period if worker arrived/accepted; 85% worker share).
- `GET /api/v1/bookings` — Lists bookings for authenticated user (paginated).
- `GET /api/v1/bookings/:id` — Retrieves detailed booking timeline, address snapshot, and audit history.

### Negotiation Endpoints (`/api/v1/bookings/:id`)
- `POST /api/v1/bookings/:id/estimate` — Worker submits on-site price estimate (labor + parts). Maximum 2 rounds per party. Automatically sets 15-minute offer validity.
- `POST /api/v1/bookings/:id/respond` — Customer responds to estimate (`ACCEPT`, `COUNTER`, `REJECT`).
  - `ACCEPT`: Transitions booking to `IN_PROGRESS` with agreed prices.
  - `COUNTER`: Proposes customer counter-offer (enforces 2-round max limit).
  - `REJECT`: Declines offer; customer can re-estimate or cancel.
- `GET /api/v1/bookings/:id/negotiation` — Retrieves full negotiation round history with active expiry status.

---

## 7. Phase 3: Payments, Worker Wallet & Platform Settlement Engine

### Worker Wallet Endpoints (`/api/v1/wallets`)
- `GET /api/v1/wallets/me` — Worker retrieves wallet balance, frozen status, and remaining negative credit limit.
- `POST /api/v1/wallets/me/topup` — Worker recharges wallet balance.
- `POST /api/v1/wallets/me/payouts` — Worker requests payout withdrawal via UPI or bank transfer.
- `GET /api/v1/wallets/me/payouts` — Lists past withdrawal payout requests.
- `GET /api/v1/wallets/me/transactions` — Full audit ledger of wallet credits, debits, commission deductions, and compensations.

### Payment & Settlement Endpoints (`/api/v1/payments`)
- `POST /api/v1/payments/process` — Process and settle job payment.
  - **Cash on Delivery (COD):** Worker receives full cash from customer; platform automatically deducts 10% platform commission on **labor only** (0% on parts) from the worker's wallet.
  - **Online Payment (UPI/Card):** Customer pays online; platform deducts 10% labor commission and credits net payout to worker's wallet.
  - **Negative Credit Limit Guard:** Worker wallet can operate up to `-₹1500` (`WALLET_MAX_NEGATIVE_LIMIT`); exceeding this limit marks `isFrozen = true` and pauses job dispatch.
- `GET /api/v1/payments/booking/:bookingId` — Retrieves payment receipt and commission breakdown for a booking.

---

## 8. Phase 4: Reviews, Ratings & Admin Verification Queue

### Reviews & Rating Endpoints (`/api/v1/reviews`)
- `POST /api/v1/reviews` — Customer submits a rating (1 to 5 stars) and optional review comment for a completed booking. Validates completion status, customer ownership, and duplicate review prevention. Automatically recalculates worker's aggregate average rating and total review count in real time.
- `POST /api/v1/reviews/:id/reply` — Worker submits an official response/reply to a customer review on their profile.
- `GET /api/v1/reviews/worker/:workerId` — Public paginated list of reviews for a worker, ordered by creation date descending.

### Admin Verification & Platform Metrics (`/api/v1/admin`)
- `POST /api/v1/admin/documents` — Worker submits an identity document for verification (`AADHAAR`, `PAN`, `DRIVING_LICENSE`, `PASSPORT`). Stores document URL and metadata in pending status.
- `GET /api/v1/admin/documents/mine` — Worker lists all their uploaded verification documents and approval statuses.
- `GET /api/v1/admin/verifications` — Admin fetches pending document review queue (filterable by status: `PENDING`, `APPROVED`, `REJECTED`, paginated). Requires `ADMIN` role.
- `POST /api/v1/admin/documents/:id/review` — Admin approves or rejects a specific document with mandatory rejection reason if rejected. Requires `ADMIN` role.
- `POST /api/v1/admin/workers/:workerId/verify` — Admin sets worker profile verification status (`isVerified: true`, `verificationStatus: 'APPROVED'`). Requires `ADMIN` role.
- `GET /api/v1/admin/metrics` — Admin retrieves platform operational and financial metrics (total bookings, completed bookings, active workers, verified workers, gross booking volume, platform net revenue, disbursed payouts). Requires `ADMIN` role.

