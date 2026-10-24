# SERVIQ — Business Rules & Policy Decisions Resolution

**Document Version:** 1.1.0  
**Status:** Approved Technical Direction & Configurable Policy Resolution  
**Scope:** Pricing, Cash Payments (COD), Worker Commissions, Cancellation Policy, and Concurrency Controls  

---

## 1. Resolution of the Four Critical Decision Points

### A. Cash on Delivery (COD) and Platform Commission Collection
* **Problem:** In cash bookings, the customer pays the worker physical cash in hand upon service completion. The platform cannot automatically deduct its commission percentage from physical banknotes.
* **Resolution / Architectural Implementation:**
  1. **Worker Digital Wallet / Platform Balance (`worker_wallets` & `worker_earnings_ledger`):**
     - Every registered worker has an internal platform ledger balance.
     - When a customer pays online via gateway, the net earning (Gross - Commission) is credited to the worker's payout balance.
     - When a customer pays in Cash on Delivery, the full gross amount remains with the worker. Concurrently, the platform commission (e.g. 10%) is **debited from the worker's platform wallet**.
  2. **Configurable Negative Credit Limit (`MAX_NEGATIVE_WALLET_BALANCE`):**
     - To ensure workers can accept cash jobs without friction, workers are allowed a configurable negative wallet limit (default: **-₹1,500.00**).
     - As long as the worker's wallet balance is within this credit limit, they can continue receiving both online and cash jobs.
  3. **Auto-Recovery & Settlement:**
     - When the worker completes future online-paid jobs, the platform automatically offsets the negative cash commission balance against their online earnings.
     - Workers can also recharge their platform wallet directly via UPI/Card in their app.
  4. **Over-Limit Guard:**
     - If a worker's negative wallet balance exceeds the allowed limit (e.g., negative balance < -₹1,500), the system automatically restricts them from going online (`is_online = false`) until their commission dues are settled.

---

### B. The Late Cancellation Policy & Trip Fee (Configurable, Non-Hardcoded)
* **Problem:** Hardcoding a ₹100 cancellation fee creates customer trust issues and does not account for arrival delays, unfair charges, or customer notification disclosures.
* **Resolution / Architectural Implementation:**
  1. **Configurable Policy Engine (`config/business-rules.ts`):**
     - `CANCELLATION_GRACE_PERIOD_MINUTES` (Default: **5 minutes** after worker assignment): 100% free cancellation for customer.
     - `CANCELLATION_PRE_DISPATCH_FEE` (Default: **₹0.00** while in `ASSIGNED` status).
     - `CANCELLATION_TRIP_FEE_AMOUNT` (Configurable, default: **₹100.00**, pending final commercial sign-off).
     - `WORKER_COMPENSATION_SHARE_PCT` (Default: **85%** / ₹85 credited to worker for travel expense).
     - `PLATFORM_HANDLING_SHARE_PCT` (Default: **15%** / ₹15 platform processing fee).
  2. **Customer Exceptions & Protection:**
     - **Worker Delay Exemption:** If the worker is running late by more than `WORKER_DELAY_THRESHOLD_MINUTES` (default: **15 minutes** past scheduled arrival window), the customer can cancel with **zero cancellation fee**.
     - **GPS Verification:** Cancellation fee applies *only* if the worker has transitioned to `ON_THE_WAY` and is verified by GPS to be actively en route.
  3. **Mandatory UI Transparency:**
     - The cancellation policy must be explicitly displayed:
       - On the booking confirmation screen prior to submission.
       - Inside the cancellation modal before the customer confirms cancellation, stating: *"A trip fee of ₹X will apply because your technician has already traveled towards your location."*

---

### C. Bounded Negotiation & Active Query-Time Offer Expiration
* **Problem:** Relying exclusively on background cron jobs to mark offers expired can allow a customer or worker to accept a stale offer during the race window between offer expiration and cron execution.
* **Resolution / Architectural Implementation:**
  1. **Configurable Limits:**
     - `MAX_NEGOTIATION_ROUNDS_PER_PARTY` (Default: **2 rounds**).
     - `OFFER_EXPIRY_MINUTES` (Default: **15 minutes**).
  2. **Active Query-Time Validation:**
     - In addition to BullMQ scheduled cleanup, every offer acceptance mutation performs an immediate query-time timestamp check:
       ```sql
       SELECT * FROM job_offers 
       WHERE id = :offerId 
         AND status = 'PENDING' 
         AND expires_at > CURRENT_TIMESTAMP 
       FOR UPDATE;
       ```
     - If `expires_at <= CURRENT_TIMESTAMP`, the database lock immediately marks the offer as `EXPIRED` and the API responds with HTTP 410 Gone (`OFFER_EXPIRED`), regardless of whether a background job has executed.
  3. **Immutability of Agreed Price:**
     - Once an offer is accepted, the agreed amount is permanently written into `bookings.agreed_price`.
     - The negotiation closes; no further counter-offers or price modifications can be submitted.

---

### D. Hybrid Dispatch with Mandatory Pessimistic Row Locking
* **Problem:** Supporting both Direct Worker Booking and Broadcast requests risks double-assignment if two workers attempt to claim the same booking concurrently.
* **Resolution / Architectural Implementation:**
  1. **Unified State Gate:** Both direct acceptance and broadcast claims pass through a single transactional gate.
  2. **Pessimistic Row Lock (`SELECT FOR UPDATE`):**
     - The booking record is locked exclusively at the database level before checking eligibility or updating status.
     - If the status is not `REQUEST_SUBMITTED` or `NEGOTIATION_IN_PROGRESS`, the transaction is rolled back and rejected with HTTP 409 Conflict.
  3. **Atomic Offer Invalidation:**
     - Upon assignment, all rival pending offers for that booking are atomically updated to `SUPERSEDED` within the same transaction.

---

## 2. Configurable Business Rules Schema

All provisional business rules are extracted into environment-aware configuration variables rather than hardcoded in domain logic:

```typescript
// src/config/business-rules.ts
export const BusinessRulesConfig = {
  // Commission & Fees
  commission: {
    serviceLaborRatePct: Number(process.env.COMMISSION_LABOR_RATE_PCT ?? 10), // Configurable (Default 10%)
    materialsFeeRatePct: 0, // Always 0% on hardware parts
    minPlatformFeeAmount: Number(process.env.MIN_PLATFORM_FEE ?? 15),
  },

  // Wallet & COD Collection
  wallet: {
    maxNegativeBalance: Number(process.env.WALLET_MAX_NEGATIVE_LIMIT ?? -1500),
    autoDebitOnCashBooking: true,
  },

  // Cancellation Policy
  cancellation: {
    gracePeriodMinutes: Number(process.env.CANCEL_GRACE_PERIOD_MINS ?? 5),
    tripFeeAmount: Number(process.env.CANCEL_TRIP_FEE_AMOUNT ?? 100), // Configurable (Default ₹100)
    workerSharePct: Number(process.env.CANCEL_WORKER_SHARE_PCT ?? 85),
    platformSharePct: Number(process.env.CANCEL_PLATFORM_SHARE_PCT ?? 15),
    workerDelayThresholdMinutes: Number(process.env.CANCEL_DELAY_THRESHOLD_MINS ?? 15),
  },

  // Negotiation & Timers
  negotiation: {
    maxRoundsPerParty: Number(process.env.MAX_NEGOTIATION_ROUNDS ?? 2),
    offerExpiryMinutes: Number(process.env.OFFER_EXPIRY_MINS ?? 15),
  },

  // Radius & Search
  discovery: {
    defaultSearchRadiusKm: Number(process.env.DEFAULT_SEARCH_RADIUS_KM ?? 10),
    maxSearchRadiusKm: 30,
  }
} as const;
```
