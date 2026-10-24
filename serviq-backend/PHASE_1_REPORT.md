# SERVIQ — Phase 1 Implementation Report: Catalog & Hyperlocal Discovery

**Status:** Completed & Validated  
**Database:** PostgreSQL 18 + PostGIS 3.6 (WGS84 EPSG:4326)  
**Test Suite Results:** 36 / 36 tests passing (100% pass rate)  
**TypeScript Build:** Clean (0 errors)

---

## 1. Executive Summary

Phase 1 has been implemented and tested against a live PostgreSQL 18 and PostGIS 3.6 spatial database. All foundational pre-checks from Phase 0 were validated, and five core domain modules were delivered:

1. **Service Catalog Engine:** Hierarchical service categories and subcategories with unique slugs, icons, active status flags, display ordering, and seed data for 8 core trades and 15 sub-trades.
2. **Customer Profiles:** Auto-initializing profile storage with display name, bio, emergency phone, and ownership-enforced CRUD.
3. **Saved Addresses with PostGIS:** Geography-based point storage, spatial indexing (`idx_addresses_geo`), coordinate range validation (`[-90, 90]`, `[-180, 180]`), and an atomic single-default address constraint backed by a partial unique index.
4. **Worker Profiles, Skills & Availability:** Decoupled identity verification from registration, role-based field immutability (workers cannot approve their own verification status), skill-to-category mappings, real-time availability toggles (`isOnline`), and GPS location tracking.
5. **Hyperlocal PostGIS Search (`GET /api/v1/workers/search`):** Great-circle radius filtering (`ST_DWithin`) using geography spatial indexing, worker service radius evaluation, fresh location checks, rating/price filtering, privacy sanitization, and deterministic pagination.
6. **Frontend Reusable API Client:** Modular client library added to `serviq-frontend/src/api/` ready for UI integration without altering existing UI design.

---

## 2. Pre-Implementation Validation

Before generating Phase 1 code, the Phase 0 foundation was verified:
- **TypeScript build:** Confirmed clean build via `tsc`.
- **Database & PostGIS:** Verified PostgreSQL 18 with PostGIS 3.6 running in WSL 2 on port 5433.
- **Migration History:** Migration `0000_optimal_kate_bishop.sql` was verified as already applied.
- **Phase 0 Automated Tests:** 9 / 9 tests in `tests/auth.test.ts` passed.

---

## 3. Database Schema & Migration Changes

Migration `0001_closed_ravenous.sql` was created and applied to the database, establishing 5 new tables and 5 indexes:

### 3.1 Tables
- **`service_categories`**: `id` (UUID PK), `name`, `slug` (unique), `description`, `icon_key`, `parent_id` (self-referencing FK for subcategories), `display_order`, `is_active`, `typical_price_min`, `typical_price_max`, timestamps.
- **`customer_profiles`**: `id` (UUID PK -> `users.id` cascade), `display_name`, `bio`, `avatar_url`, `emergency_phone`, timestamps.
- **`addresses`**: `id` (UUID PK), `customer_id` (FK -> `customer_profiles.id` cascade), `address_label`, `recipient_name`, `recipient_phone`, `address_line_1`, `address_line_2`, `locality`, `city`, `state`, `postal_code`, `latitude`, `longitude`, `is_default`, timestamps.
- **`worker_profiles`**: `id` (UUID PK -> `users.id` cascade), `display_name`, `bio`, `avatar_url`, `experience_years`, `is_verified` (default false), `verification_status` (`UNVERIFIED`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`), `is_online` (default false), `service_radius_km`, `base_visiting_fee`, `working_hours` (JSONB), `latitude`, `longitude`, `last_location_updated_at`, `average_rating`, `total_reviews_count`, `completed_jobs_count`, `profile_completeness_pct`, timestamps.
- **`worker_skills`**: Composite PK (`worker_id`, `category_id`), `experience_months`.

### 3.2 Spatial & Integrity Indexes
- **`idx_worker_profiles_geo`**: GiST index on `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`.
- **`idx_addresses_geo`**: GiST index on `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`.
- **`uniq_customer_default_address`**: Partial unique index on `addresses (customer_id) WHERE is_default = true`, ensuring database-level enforcement of at most one default address per customer.
- **`idx_service_categories_active`**: Index on `(is_active, display_order)`.
- **`idx_worker_profiles_search`**: Index on `(is_online, is_verified, verification_status)`.

---

## 4. API Specification & Endpoints Implemented

| Endpoint | Method | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/categories` | `GET` | Public | List active categories & subcategories |
| `/api/v1/categories/:slug` | `GET` | Public | Category details by slug |
| `/api/v1/categories` | `POST` | `ADMIN` | Create new category |
| `/api/v1/categories/:id` | `PATCH` | `ADMIN` | Update category |
| `/api/v1/customers/me` | `GET` | `CUSTOMER` | Get/auto-init own customer profile |
| `/api/v1/customers/me` | `PUT` | `CUSTOMER` | Update own customer profile |
| `/api/v1/addresses` | `GET` | `CUSTOMER` | List customer saved addresses |
| `/api/v1/addresses` | `POST` | `CUSTOMER` | Add address with lat/lon validation |
| `/api/v1/addresses/:id` | `PUT` | `CUSTOMER` | Update address (Ownership enforced) |
| `/api/v1/addresses/:id` | `DELETE` | `CUSTOMER` | Delete address (Ownership enforced) |
| `/api/v1/addresses/:id/default`| `PATCH` | `CUSTOMER` | Set default address atomically |
| `/api/v1/workers/me` | `GET` | `WORKER`, `ADMIN` | Get worker profile with skills & contact |
| `/api/v1/workers/me` | `PUT` | `WORKER` | Update allowed profile fields |
| `/api/v1/workers/availability`| `PATCH` | `WORKER` | Toggle `isOnline` status |
| `/api/v1/workers/location` | `PATCH` | `WORKER` | Update worker real-time GPS coordinates |
| `/api/v1/workers/skills` | `GET` | `WORKER` | List worker skills |
| `/api/v1/workers/skills` | `POST` | `WORKER` | Add category skill |
| `/api/v1/workers/skills/:categoryId`| `DELETE`| `WORKER` | Remove category skill |
| `/api/v1/workers/:id` | `GET` | Public | Sanitized public profile (No phone/exact coords) |
| `/api/v1/workers/:id/verification`| `PATCH`| `ADMIN` | Admin approval/rejection of verification |
| `/api/v1/workers/search` | `GET` | Public | PostGIS hyperlocal search |

---

## 5. PostGIS Hyperlocal Search Engine

### 5.1 Coordinate Reference System (CRS) & Units
- **CRS:** WGS84 (`EPSG:4326`).
- **PostGIS Storage Type:** `geography(Point, 4326)` representing spherical Earth distance.
- **Distance Calculation:** `ST_Distance` computes distances natively in **meters**, converted to rounded **kilometers** (`distanceKm`) in API outputs.

### 5.2 Search Eligibility Rules
A worker is returned in search results only when all criteria match:
1. `users.status = 'ACTIVE'` (Suspended accounts are strictly excluded).
2. `worker_profiles.is_verified = true AND worker_profiles.verification_status = 'APPROVED'` (Unverified workers cannot be discovered).
3. `worker_profiles.latitude IS NOT NULL AND worker_profiles.longitude IS NOT NULL`.
4. `ST_DWithin(worker_geography, search_geography, LEAST(search_radius_meters, worker_service_radius_meters))` — worker is within customer search radius AND search point is within worker's stated service radius.
5. If `availableNow = true`: Worker must have `is_online = true` and `last_location_updated_at` within 24 hours (stale locations excluded).
6. If `category` specified: Worker must have an active skill mapped to the category slug or ID.
7. If `minRating` specified: Worker average rating must meet or exceed the threshold.
8. If `maxPrice` specified: Worker base visiting fee must be within the limit.

### 5.3 Privacy Sanitization
Public discovery and profile endpoints strictly exclude:
- Worker private phone number and email.
- Worker exact private residential coordinates.
- Identity verification document references.
Only approximate distance (`distanceKm`), public display name, rating, verified badge, skills, base fee, and working hours are exposed.

---

## 6. Automated Test Suite Results

Test suite `tests/catalog-discovery.test.ts` runs directly against live PostgreSQL 18 + PostGIS 3.6 without mocking spatial queries:

```
 ✓ tests/auth.test.ts (9 tests) 62ms
 ✓ tests/catalog-discovery.test.ts (27 tests) 555ms

 Test Files  2 passed (2)
      Tests  36 passed (36)
   Start at  06:24:51
   Duration  2.05s
```

### Coverage Highlights:
- **Category Listing & Inactive Filtering:** Active categories retrieved; inactive categories hidden from public discovery.
- **Profile Ownership:** Customer 1 cannot access or alter Customer 2's profile.
- **Coordinate Validation:** Latitude > 90 or Longitude > 180 rejected with validation errors.
- **Default Address Atomicity:** Creating a second default address atomically demotes the previous default.
- **Spatial Radius Precision:** Search from Dadar, Mumbai (10 km radius) correctly includes Bandra (~5.0 km), excludes Andheri (~10.8 km) and Thane (~26.0 km).
- **Boundary Test:** Expanding radius to 15 km correctly includes Andheri (~10.8 km) while still excluding Thane.
- **Unverified & Suspended Worker Exclusion:** Unverified and suspended workers located in Bandra West are completely excluded from search results.
- **Availability Filter:** `availableNow=true` excludes offline workers while `availableNow=false` retains them for scheduled bookings.
- **Safe Maximum Radius:** Queries requesting > 30 km radius are rejected with 422 validation errors.

---

## 7. Frontend Client Integration

Reusable API client modules were created in `serviq-frontend/serviq-frontend/src/api/`:
- `client.js`: Centralized fetch wrapper with Bearer token injection and error normalization.
- `catalog.js`: `getCategories()`, `getCategoryBySlug(slug)`.
- `discovery.js`: `searchWorkers(options)`.
- `customer.js`: Customer profiles & saved addresses CRUD.
- `worker.js`: Worker profile, availability toggle, GPS update, skills management.

Existing frontend visual design and component state remain intact for subsequent UI phase wiring.

---

## 8. Next Steps & Phase 2 Gate

Phase 1 is complete and tested. Per project constraints, **Phase 2 (Booking & Negotiation Engine)** will only commence upon user review and approval of this Phase 1 deliverable.
