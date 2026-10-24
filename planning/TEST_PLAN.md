# SERVIQ — Testing & Quality Assurance Plan

**Document Version:** 1.0.0  
**Target Quality Level:** Production-Grade Marketplace Certification  
**Test Frameworks:** Vitest (Unit & Integration), Testcontainers (PostgreSQL + PostGIS + Redis), Supertest (HTTP assertions), Playwright (E2E Browser Scenarios)  

---

## 1. Multi-Tier Testing Strategy

```
           / \
          /   \        E2E Tests (Playwright)
         /     \       - Full customer-to-worker lifecycle
        /       \      - Real-time chat & status sync
       /---------\
      /           \    Integration & Security Tests
     /             \   - API contract validation with Testcontainers
    /               \  - Concurrency & race condition simulation
   /-----------------\
  /                   \ Unit Tests
 /                     \ - Pricing arithmetic, fee splits, ledger
/                       \- State machine gates & transition guards
-------------------------
```

---

## 2. Unit Testing Suite

### 2.1 Pricing & Financial Arithmetic
- **Test File:** `src/modules/earnings/__tests__/pricing.service.spec.ts`
- **Scenarios to Test:**
  1. Base Fee Split: Given agreed price ₹450, verify 10% platform fee = ₹45, net worker earning = ₹405.
  2. Extra Approved Materials: Given base ₹450 + materials ₹200, verify commission is charged *only* on service labor (₹45), while materials (₹200) are passed 100% to worker.
  3. Cancellation Fee Distribution: Given ₹100 customer late cancellation fee, verify worker receives ₹85 compensation and platform retains ₹15 processing fee.
  4. Currency Rounding: Ensure zero floating-point drift over 10,000 ledger transactions.

### 2.2 Booking State Machine Transition Guards
- **Test File:** `src/modules/bookings/__tests__/state-machine.spec.ts`
- **Scenarios to Test:**
  1. Valid Forward Steps: Assert `REQUEST_SUBMITTED` -> `ASSIGNED` -> `ON_THE_WAY` -> `ARRIVED` -> `WORK_STARTED` -> `WORK_COMPLETED` succeeds.
  2. Illegal Skips: Assert attempting to jump from `REQUEST_SUBMITTED` directly to `WORK_COMPLETED` throws `InvalidStateTransitionError`.
  3. Role-Enforced Guards: Assert a customer cannot transition a booking to `ON_THE_WAY` (Worker-only action).
  4. OTP Verification: Assert transitioning from `ARRIVED` to `WORK_STARTED` fails if the provided OTP does not match `start_verification_otp`.

---

## 3. Integration & Database Concurrency Tests

### 3.1 Real Database Testing via Testcontainers
- Integration tests run against an isolated **Dockerized PostgreSQL 16 + PostGIS** container spawned automatically during test setup, ensuring 100% parity with production SQL constraints.

### 3.2 Automated Race Condition Test (Simultaneous Job Claiming)
- **Objective:** Prove that exactly one worker can claim an exclusive booking when two or more workers attempt acceptance concurrently.
- **Test Script Structure (`tests/concurrency/booking-claim.spec.ts`):**
  ```typescript
  it('should allow only one worker to accept a broadcast booking and reject the second with 409 Conflict', async () => {
    // 1. Arrange: Create broadcast booking in REQUEST_SUBMITTED state
    const booking = await createTestBooking({ dispatchType: 'BROADCAST', status: 'REQUEST_SUBMITTED' });
    const workerA = await createTestWorker();
    const workerB = await createTestWorker();

    // 2. Act: Fire simultaneous accept requests using Promise.all
    const [responseA, responseB] = await Promise.all([
      request(app.server)
        .post(`/api/v1/bookings/${booking.id}/accept`)
        .set('Authorization', `Bearer ${workerA.token}`),
      request(app.server)
        .post(`/api/v1/bookings/${booking.id}/accept`)
        .set('Authorization', `Bearer ${workerB.token}`)
    ]);

    // 3. Assert: Exactly one 200 OK and exactly one 409 Conflict
    const statuses = [responseA.status, responseB.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Verify DB integrity
    const updatedBooking = await db.query.bookings.findFirst({ where: eq(bookings.id, booking.id) });
    expect(updatedBooking.status).toBe('ASSIGNED');
    expect([workerA.id, workerB.id]).toContain(updatedBooking.assignedWorkerId);
  });
  ```

---

## 4. Security & Access Control (Penetration Test Cases)

| Test Identifier | Security Target | Attack / Test Payload | Expected Assertion |
| :--- | :--- | :--- | :--- |
| **SEC-01** | **IDOR Prevention (Booking)** | Customer A calls `GET /api/v1/bookings/:id` for a booking belonging to Customer B. | HTTP 403 Forbidden |
| **SEC-02** | **IDOR Prevention (Earnings)** | Worker A calls `GET /api/v1/workers/earnings` with Worker B's ID in header or query. | Server ignores query and reads strictly from JWT `sub`; returns Worker A's data |
| **SEC-03** | **Unauthenticated Access** | Request to `/api/v1/customers/addresses` without `Authorization` header. | HTTP 401 Unauthorized |
| **SEC-04** | **Rate Limiting Enforcement**| Calling `/api/v1/auth/request-otp` 5 times in 60 seconds from same IP. | Requests 1-3 return 200; Requests 4-5 return 429 Too Many Requests |
| **SEC-05** | **XSS & SQL Injection** | Submitting `<script>alert('xss')</script>' OR 1=1;--` in `issueDescription`. | Content is sanitized; parameterized query executes safely without syntax errors |
| **SEC-06** | **Arbitrary Price Tampering** | Customer sends `POST /api/v1/bookings` with `customerBudget: -500`. | HTTP 422 Unprocessable Entity (Zod validation failure) |

---

## 5. End-to-End (E2E) Browser Workflows (Playwright)

### 5.1 Scenario: Happy Path Direct Booking & Negotiation
1. **Customer Actor:**
   - Logs in with test phone OTP.
   - Searches for "Plumber" in Bhayandar West.
   - Opens Ramesh Patil's profile and clicks "Book now".
   - Fills form: Tap repair, scheduled for Today, budget ₹400. Submits request.
2. **Worker Actor (Parallel Browser Context):**
   - Ramesh Patil is logged in on worker dashboard.
   - Receives instant incoming request notification for `SQ-1048`.
   - Clicks "Counter-Offer", selects ₹450 with note: *"Parts included"*, and submits.
3. **Customer Actor:**
   - Customer view receives live counter-offer modal update (₹450).
   - Customer clicks "Accept Counter-Offer".
4. **Execution Verification:**
   - Booking transitions to `ASSIGNED` on both browser screens without page reload.
   - Chat window opens; customer sends message: *"Please ring bell 402."*
   - Worker sees message in real-time.
   - Worker marks `ON_THE_WAY` -> `ARRIVED` -> `WORK_STARTED` (enters OTP) -> `WORK_COMPLETED`.
   - Customer pays via test gateway; leaves 5-star review.
   - Worker dashboard reflects updated earnings (+₹405 net) and review count (+1).
