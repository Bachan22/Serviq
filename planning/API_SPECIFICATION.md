# SERVIQ — REST API Specification & Contract

**Document Version:** 1.0.0  
**API Base URL:** `/api/v1`  
**Content-Type:** `application/json`  
**Authentication Scheme:** `Bearer <JWT_ACCESS_TOKEN>` or HttpOnly Session Cookie  

---

## 1. Global Standards & Conventions

### 1.1 Success Response Envelope
Every successful response returns HTTP 200/201 with standard metadata:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "totalPages": 5
  }
}
```

### 1.2 Error Response Envelope
Every failed request returns standard error payload:
```json
{
  "success": false,
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human readable message for display or logging.",
    "details": []
  },
  "timestamp": "2026-10-24T05:30:00.000Z",
  "requestId": "req-8f192-b4c"
}
```

### 1.3 HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Malformed JSON or syntax failure.
- `401 Unauthorized`: Missing, expired, or invalid JWT.
- `403 Forbidden`: Authenticated user lacks permission or does not own the resource.
- `404 Not Found`: Resource does not exist.
- `409 Conflict`: Concurrency conflict (e.g. job already accepted by another worker).
- `422 Unprocessable Entity`: Input validation failure (e.g., Zod schema errors).
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unexpected server exception.

---

## 2. API Endpoints by Module

### 2.1 Module: Authentication & Session (`/api/v1/auth`)

#### `POST /api/v1/auth/request-otp`
- **Purpose:** Initiates phone number verification by sending an SMS OTP.
- **Auth:** Public.
- **Request Body:**
  ```json
  { "phoneNumber": "+919876543210" }
  ```
- **Validation:** Must be valid E.164 phone number.
- **Success Response (200):**
  ```json
  { "success": true, "data": { "message": "OTP sent successfully", "expiresInSeconds": 300 } }
  ```
- **Errors:** 429 Too Many Requests (rate limit: 3 requests per 10 mins).
- **Side Effects:** Stores encrypted OTP in Redis with 5-minute TTL; dispatches SMS gateway event.

#### `POST /api/v1/auth/verify-otp`
- **Purpose:** Verifies OTP and returns access token + sets rotating refresh token cookie.
- **Auth:** Public.
- **Request Body:**
  ```json
  { "phoneNumber": "+919876543210", "otp": "492810", "requestedRole": "CUSTOMER" }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "u-01934b12-32a1",
        "phoneNumber": "+919876543210",
        "roles": ["CUSTOMER"],
        "hasCompletedProfile": true
      },
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "expiresIn": 900
    }
  }
  ```
- **Errors:** 401 Unauthorized (Invalid or expired OTP).
- **DB Operations:** Upserts `users` record; registers `user_roles`.

#### `POST /api/v1/auth/logout`
- **Purpose:** Invalidate refresh token and session.
- **Auth:** Required.
- **Success Response (200):** `{ "success": true, "data": { "message": "Logged out successfully" } }`
- **Side Effects:** Revokes refresh token in Redis; clears cookie.

---

### 2.2 Module: Customer Profile & Addresses (`/api/v1/customers`)

#### `GET /api/v1/customers/me`
- **Purpose:** Returns authenticated customer's profile, default address, and preferences.
- **Auth:** Required (`CUSTOMER` role).
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "u-01934b12-32a1",
      "firstName": "Gurubachan",
      "lastName": "Singh",
      "phoneNumber": "+919876543210",
      "email": "user@example.com",
      "avatarUrl": "https://storage.serviq.in/avatars/gs.png",
      "defaultAddress": {
        "id": "addr-1092",
        "label": "Home",
        "locality": "Bhayandar West",
        "city": "Mumbai"
      }
    }
  }
  ```

#### `GET /api/v1/customers/addresses`
- **Purpose:** Lists all saved customer addresses.
- **Auth:** Required (`CUSTOMER` role).
- **Success Response (200):** Returns array of address objects.

#### `POST /api/v1/customers/addresses`
- **Purpose:** Save a new address.
- **Auth:** Required (`CUSTOMER` role).
- **Request Body:**
  ```json
  {
    "addressLabel": "Office",
    "addressLine1": "Unit 402, Trade Tower",
    "addressLine2": "Link Road, Near Metro",
    "locality": "Mira Road East",
    "city": "Mumbai",
    "postalCode": "401107",
    "latitude": 19.2812,
    "longitude": 72.8561,
    "isDefault": false
  }
  ```
- **Validation:** Latitude (-90 to 90), Longitude (-180 to 180), non-empty address fields.
- **Success Response (201):** Returns created address object.
- **DB Operations:** Inserts into `addresses`; if `isDefault = true`, unsets previous default in a transaction.

---

### 2.3 Module: Discovery, Services & Worker Search (`/api/v1/services` & `/api/v1/workers`)

#### `GET /api/v1/services/categories`
- **Purpose:** Returns service categories with active provider counts.
- **Auth:** Public.
- **Query Params:** `latitude` (optional), `longitude` (optional).
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "cat-plumbing",
        "name": "Plumbing",
        "slug": "plumbing",
        "iconKey": "Wrench",
        "nearbyWorkerCount": 24,
        "typicalStartingPrice": 350.00
      }
    ]
  }
  ```

#### `GET /api/v1/workers/search`
- **Purpose:** Hyperlocal discovery of eligible professionals within radius.
- **Auth:** Public or Authenticated.
- **Query Params:**
  - `latitude` (required, float)
  - `longitude` (required, float)
  - `categorySlug` (optional, string)
  - `radiusKm` (optional, default `10.0`, max `30.0`)
  - `minRating` (optional, float)
  - `verifiedOnly` (optional, boolean)
  - `availableNow` (optional, boolean)
  - `sortBy` (enum: `'distance'`, `'rating'`, `'price_asc'`, `'relevance'`)
  - `page`, `limit`
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "w-01934c99-4a",
        "name": "Ramesh Patil",
        "initials": "RP",
        "jobTitle": "Plumbing specialist",
        "rating": 4.9,
        "reviewCount": 128,
        "completedJobs": 286,
        "startingPrice": 350.00,
        "distanceKm": 1.2,
        "distanceDisplay": "1.2 km away",
        "isVerified": true,
        "estimatedArrival": "20–30 min"
      }
    ],
    "meta": { "total": 14, "page": 1, "limit": 10 }
  }
  ```
- **DB Operations:** PostGIS `ST_DWithin` and `ST_DistanceSphere` against `worker_service_areas` and `addresses`.

---

### 2.4 Module: Bookings & Creation (`/api/v1/bookings`)

#### `POST /api/v1/bookings`
- **Purpose:** Customer submits a new booking request (direct or broadcast).
- **Auth:** Required (`CUSTOMER` role).
- **Request Body:**
  ```json
  {
    "serviceId": "srv-plumb-tap",
    "addressId": "addr-1092",
    "preferredWorkerId": "w-01934c99-4a",
    "dispatchType": "DIRECT",
    "scheduleType": "IMMEDIATE",
    "scheduledStartTime": null,
    "issueDescription": "Kitchen sink pipe is leaking heavily under the counter.",
    "customerBudget": 450.00
  }
  ```
- **Validation:**
  - `addressId` must belong to authenticated customer.
  - `customerBudget` must be >= platform minimum base visit fee (e.g., ₹150).
  - If `dispatchType == 'DIRECT'`, `preferredWorkerId` is required.
- **Success Response (201):**
  ```json
  {
    "success": true,
    "data": {
      "bookingId": "b-90123-af",
      "bookingCode": "SQ-1048",
      "status": "REQUEST_SUBMITTED",
      "dispatchType": "DIRECT",
      "customerBudget": 450.00,
      "createdAt": "2026-10-24T05:30:00Z"
    }
  }
  ```
- **DB Operations:**
  - Inserts into `bookings`.
  - Appends to `booking_status_history` (`from_status: null`, `to_status: 'REQUEST_SUBMITTED'`).
  - Creates 1-to-1 entry in `conversations`.
- **Side Effects:** Emits Socket.io event `request:new` to targeted worker or nearby broadcast worker room; enqueues 15-minute response timer in BullMQ.

#### `GET /api/v1/bookings`
- **Purpose:** List bookings for the authenticated user (filtered automatically by customer ID or worker ID).
- **Auth:** Required.
- **Query Params:** `status` (optional), `page`, `limit`.
- **Success Response (200):** Paginated array of booking summaries.

#### `GET /api/v1/bookings/:id`
- **Purpose:** Retrieve complete booking detail, current state, assigned worker, agreed price, and status history.
- **Auth:** Required (Must be booking owner customer, assigned worker, or Admin).
- **Success Response (200):** Complete booking representation.

---

### 2.5 Module: Price Negotiation & Offers (`/api/v1/bookings/:id/offers`)

#### `POST /api/v1/bookings/:id/offers`
- **Purpose:** Worker or customer submits a counter-offer.
- **Auth:** Required (`WORKER` or `CUSTOMER`).
- **Request Body:**
  ```json
  {
    "offeredPrice": 500.00,
    "notes": "Includes gasket replacement and labor."
  }
  ```
- **Validation:**
  - Booking status must be `REQUEST_SUBMITTED` or `NEGOTIATION_IN_PROGRESS`.
  - `offeredPrice` > 0.
  - Role check: If customer counters, worker must have submitted previous offer; if worker counters, worker must be targeted or eligible broadcast candidate.
- **Success Response (201):**
  ```json
  {
    "success": true,
    "data": {
      "offerId": "off-8123-bc",
      "bookingId": "b-90123-af",
      "offeredPrice": 500.00,
      "status": "PENDING",
      "expiresAt": "2026-10-24T05:45:00Z"
    }
  }
  ```
- **DB Operations:** Inserts into `job_offers`; updates `bookings.status = 'NEGOTIATION_IN_PROGRESS'`.
- **Side Effects:** Socket.io notification to counterparty; resets offer expiration timer.

#### `POST /api/v1/bookings/:id/offers/:offerId/accept`
- **Purpose:** Accept a pending offer, locking the price and assigning the worker atomically.
- **Auth:** Required (Counterparty of whoever made the offer).
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "bookingId": "b-90123-af",
      "status": "ASSIGNED",
      "assignedWorkerId": "w-01934c99-4a",
      "agreedPrice": 500.00,
      "message": "Offer accepted and worker assigned successfully."
    }
  }
  ```
- **Atomic Database Transaction & Concurrency Lock:**
  1. Executes `SELECT * FROM bookings WHERE id = :id FOR UPDATE;`
  2. Asserts status is `REQUEST_SUBMITTED` or `NEGOTIATION_IN_PROGRESS`.
  3. Verifies target offer is `PENDING` and `expires_at > CURRENT_TIMESTAMP`.
  4. Updates `job_offers` set `status = 'ACCEPTED'` where `id = :offerId`.
  5. Updates all rival offers for this booking set `status = 'SUPERSEDED'`.
  6. Updates `bookings` set `status = 'ASSIGNED'`, `assigned_worker_id = :workerId`, `agreed_price = :price`.
  7. Inserts into `booking_status_history`.
- **Errors:** 409 Conflict (Job already claimed or offer expired).
- **Side Effects:** Real-time socket broadcast to winning worker (`booking:assigned`) and loser workers (`request:closed`); enqueues customer push notification.

---

### 2.6 Module: Job Execution & Status Management (`/api/v1/bookings/:id/status`)

#### `PATCH /api/v1/bookings/:id/status`
- **Purpose:** Advance the booking lifecycle state.
- **Auth:** Required.
- **Request Body:**
  ```json
  {
    "nextStatus": "WORK_STARTED",
    "verificationOtp": "8412",
    "cancellationReason": null
  }
  ```
- **Validation Matrix:**
  - `ASSIGNED` -> `ON_THE_WAY`: Worker only.
  - `ON_THE_WAY` -> `ARRIVED`: Worker only.
  - `ARRIVED` -> `WORK_STARTED`: Worker only (requires matching `start_verification_otp`).
  - `WORK_STARTED` -> `WORK_COMPLETED`: Worker only.
  - Any state prior to `WORK_STARTED` -> `CANCELLED`: Permitted actor based on cancellation policy.
- **Success Response (200):** Returns updated booking object.
- **Errors:** 400 Bad Request (Invalid transition), 403 Forbidden, 422 Unprocessable (Invalid OTP).
- **Side Effects:** Status history write, socket state sync, SMS/Push trigger.

---

### 2.7 Module: Real-Time Messaging (`/api/v1/conversations`)

#### `GET /api/v1/conversations`
- **Purpose:** List all active conversations for the current user.
- **Auth:** Required.

#### `GET /api/v1/conversations/:id/messages`
- **Purpose:** Fetch message history for a booking conversation.
- **Auth:** Required (Participant only).
- **Query Params:** `limit` (default 50), `before` (cursor timestamp).

#### `POST /api/v1/conversations/:id/messages`
- **Purpose:** Send a new message (HTTP fallback when WebSocket unavailable).
- **Auth:** Required (Participant only).
- **Request Body:**
  ```json
  {
    "body": "I have reached your building gate.",
    "attachmentUrl": null
  }
  ```
- **Success Response (201):** Returns created message object.
- **Side Effects:** Socket event `message:new` dispatched to conversation room.

---

### 2.8 Module: Worker Dashboard & Financials (`/api/v1/workers`)

#### `GET /api/v1/workers/dashboard`
- **Purpose:** Returns all real-time calculated metrics for the worker workspace.
- **Auth:** Required (`WORKER` role).
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "isOnline": true,
      "metrics": {
        "todayEarnings": 1840.00,
        "completedJobsThisWeek": 8,
        "averageRating": 4.82,
        "reviewCount": 96,
        "avgResponseTimeMinutes": 12
      },
      "earningsOverview": {
        "earnedThisWeek": 8640.00,
        "percentageGrowthVsLastWeek": 12.8,
        "weeklyDailyBreakdown": [
          { "day": "Mon", "amount": 1200.00 },
          { "day": "Tue", "amount": 1800.00 },
          { "day": "Wed", "amount": 1450.00 },
          { "day": "Thu", "amount": 2400.00 },
          { "day": "Fri", "amount": 1990.00 },
          { "day": "Sat", "amount": 2800.00 },
          { "day": "Sun", "amount": 2200.00 }
        ]
      },
      "activeJobsCount": 1,
      "pendingRequestsCount": 3
    }
  }
  ```

#### `GET /api/v1/workers/earnings`
- **Purpose:** Detailed earnings ledger and settlement breakdown.
- **Auth:** Required (`WORKER` role).
- **Query Params:** `startDate`, `endDate`, `page`, `limit`.
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "summary": {
        "grossEarnings": 10500.00,
        "platformCommission": 1050.00,
        "netEarnings": 9450.00,
        "pendingSettlement": 1840.00,
        "clearedPayouts": 7610.00
      },
      "ledgerEntries": [
        {
          "id": "ledg-1048",
          "bookingCode": "SQ-1048",
          "serviceName": "Kitchen tap repair",
          "completedAt": "2026-10-24T10:30:00Z",
          "grossAmount": 450.00,
          "commission": 45.00,
          "netAmount": 405.00,
          "status": "SETTLED"
        }
      ]
    }
  }
  ```

---

### 2.9 Module: Reviews & Ratings (`/api/v1/reviews`)

#### `POST /api/v1/reviews`
- **Purpose:** Customer submits review for a completed booking.
- **Auth:** Required (`CUSTOMER` role).
- **Request Body:**
  ```json
  {
    "bookingId": "b-90123-af",
    "rating": 5,
    "comment": "Ramesh arrived on time, was very polite, and fixed the leak quickly.",
    "qualityTags": ["Punctual", "Clean Work", "Fair Price"]
  }
  ```
- **Validation:**
  - Booking status must be `CONFIRMED_COMPLETED` or `PAID`.
  - Customer must be the booking owner.
  - Review must not already exist for this `bookingId` (unique constraint).
- **Success Response (201):** Returns created review object.
- **Side Effects:** Recalculates worker's `average_rating` and `total_reviews_count` in a background job.
