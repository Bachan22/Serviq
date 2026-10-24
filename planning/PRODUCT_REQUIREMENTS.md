# SERVIQ — Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Architecture Planning  
**Classification:** Internal Core Blueprint  
**Target Platform:** Hyperlocal Blue-Collar Services Marketplace  

---

## 1. Executive Summary & Vision

**Serviq** is a hyperlocal on-demand marketplace connecting household customers with verified local blue-collar service professionals (plumbers, electricians, carpenters, appliance technicians, cleaners, painters, and cooks).

The primary value proposition is **transparent, verified, and friction-free home service fulfillment** featuring:
- Accurate local discovery based on geographical proximity.
- Flexible pricing through an interactive, bounded negotiation/counter-offer engine.
- End-to-end booking lifecycle management from request dispatch to payment and verified review.
- Dual-role empowerment: reliable service for customers, predictable earnings and business autonomy for blue-collar workers.

---

## 2. Personas & Stakeholder Profiles

### 2.1 The Customer
- **Demographics:** Urban and suburban households, apartment owners, tenants, and local offices.
- **Key Needs:** Fast response time, transparent pricing without hidden surprises, verified trustworthy workers, clear schedule tracking, and dispute protection.
- **Key Behaviors:** Searches for immediate emergency repairs (e.g., leaking tap, blackout) or schedules future home maintenance (e.g., weekend deep cleaning, AC servicing).

### 2.2 The Service Professional ("Worker")
- **Demographics:** Individual tradespeople, independent technicians, small service teams.
- **Key Needs:** Fair job opportunities nearby, freedom to counter-offer when job scope exceeds initial estimate, guaranteed payment/earnings visibility, and low platform commission friction.
- **Key Behaviors:** Operates mobile-first; toggles online/offline availability; evaluates job request details (location, customer budget, scope) before committing.

### 2.3 The Platform Operator (Admin / Support / Operations)
- **Key Needs:** Manual/automated KYC verification of worker identities and trade licenses, dispute arbitration, payment settlement control, fraud/abuse prevention, and platform metric visibility.

---

## 3. Product Requirement Categorization Matrix

Every platform capability is formally tagged under one of four governance states:
- **[CONFIRMED]**: Explicitly mandated by core requirements and established product goals.
- **[PROPOSED]**: Architectural/product design recommendation engineered for robustness and scalability.
- **[UNRESOLVED]**: Critical business decision requiring stakeholder sign-off prior to backend execution.
- **[FUTURE]**: Post-MVP capability intentionally designed into data contracts for modular rollout.

---

## 4. Detailed Module Specifications

### Module 1: Customer Account & Profile
- **1.1 Authentication & Sessions [CONFIRMED]:**
  - Registration via Phone Number with OTP verification and optional email/password.
  - JWT session issuance (short-lived access tokens + rotating refresh tokens in secure HttpOnly cookies).
  - Logout with token invalidation and device session cleanup.
- **1.2 Profile Management [CONFIRMED]:**
  - Full name, primary phone number, secondary contact number, email, avatar image.
- **1.3 Saved Addresses [CONFIRMED]:**
  - Multiple saved addresses per customer (e.g., Home, Office, Parents, Rental).
  - Attributes: Label, Flat/House No, Building/Street, Area/Locality, City, Postal Code, Latitude, Longitude, Landmark, and `is_default` boolean.
  - Exactly one default address enforced at database level.
- **1.4 Customer Preferences [PROPOSED]:**
  - Communication preferences (SMS, WhatsApp, Push notifications), language preference.
- **1.5 Account Deletion & Anonymization [PROPOSED]:**
  - Soft-delete with GDPR/data privacy compliance; retention of immutable financial transactions for statutory audit periods.

### Module 2: Service Discovery & Search
- **2.1 Taxonomy & Categories [CONFIRMED]:**
  - Two-tier hierarchical taxonomy: Service Category (e.g., Plumbing) -> Service Types (e.g., Tap Repair, Drain Unclogging, Pipe Fitting).
  - Icon asset, promotional banner, base pricing guidance, and searchable keywords.
- **2.2 Worker Directory & Geo-Search [CONFIRMED]:**
  - Geospatial query matching workers whose active service radius encompasses the customer's selected address.
  - Filtering parameters: Category, Distance (km radius), Worker Online Availability, Base Price Range, Minimum Rating (e.g., 4.5+), and Verified Only.
  - Sorting parameters: Distance (nearest first), Rating (highest first), Completed Jobs (experience), Base Price (low to high / high to low), and Hybrid "Relevance" score.
- **2.3 Worker Profile Public View [CONFIRMED]:**
  - Public profile displaying full name, trade badges, verified identity checkmark (strictly if approved), years of experience, service area radius, customer reviews with aggregated rating distribution, and base rate guidance.
- **2.4 Empty & Edge State Handling [CONFIRMED]:**
  - Clear zero-result feedback when no workers are within radius or online, offering category alerts or scheduling for future slots.

### Module 3: Booking Creation & Pricing Models
- **3.1 Booking Dispatch Modes [PROPOSED]:**
  - **Direct Booking:** Customer specifically selects a preferred professional from the directory and sends a booking request directly to them.
  - **Broadcast Request ("Instant Pool"):** Customer posts an open job request to all eligible, active, online workers within a defined radius (e.g., 5 km). First worker to agree or submit acceptable counter is assigned.
- **3.2 Booking Input Payload [CONFIRMED]:**
  - Selected service category and specific sub-service.
  - Service address ID (validated to exist and belong to the authenticated customer).
  - Scheduling: Immediate ("As soon as possible") vs Scheduled (Date picker + predefined time slots).
  - Problem description (text area, min 10 chars, max 1000 chars).
  - Issue media attachments [PROPOSED]: Up to 4 images/short video clips to help technicians diagnose scope.
  - Customer Budget / Initial Offer amount.
- **3.3 Pricing Hierarchy & Formal Definitions [CONFIRMED]:**
  - **Estimated Price / Base Rate:** Informational baseline suggested by platform or worker's standard inspection fee (e.g., ₹350 visit fee).
  - **Customer Budget:** The initial price proposed by the customer when submitting a booking request.
  - **Worker Quote / Counter-Offer:** Price proposed by the worker after assessing the problem description and location.
  - **Agreed Price:** The mutually locked price resulting from an accepted offer or accepted counter-offer.
  - **Final Payable Amount:** `Agreed Price + Approved Extra Material Costs + Taxes + Platform Convenience Fee - Discounts/Coupons`.

### Module 4: Worker Selection & Bounded Price Negotiation
- **4.1 Negotiation Principles [CONFIRMED]:**
  - Never allow silent overwrites or race conditions between simultaneous worker offers.
  - Offer validity windows enforced via server timers (e.g., 15 minutes per offer before auto-expiry).
- **4.2 Negotiation Mechanics [PROPOSED]:**
  - Worker can: (a) Accept customer budget directly, (b) Reject request, or (c) Submit a counter-offer with an optional scope explanation note.
  - Customer can: (a) Accept worker counter-offer, (b) Reject counter-offer, or (c) Submit a final re-counter (capped at 2 negotiation rounds per party to prevent infinite loops).
- **4.3 Broadcast Concurrency & Lock Acquisition [CONFIRMED]:**
  - When broadcast to multiple workers, multiple workers may submit counter-offers.
  - The booking remains open until either:
    1. A worker accepts the customer's listed budget directly (subject to atomic check).
    2. The customer accepts one specific worker's counter-offer.
  - At the exact moment of acceptance, an atomic database transaction acquires an exclusive lock, transitions the booking to `ASSIGNED`, associates the winning `worker_id`, locks the `agreed_price`, and automatically cancels/expires all pending rival offers with an event notification to other participating workers.

### Module 5: Job Execution Lifecycle
- **5.1 State Machine Specification [CONFIRMED]:**
  The booking must strictly advance through validated state gates:
  1. `DRAFT`: Form being composed.
  2. `REQUEST_SUBMITTED`: Persisted and awaiting worker responses.
  3. `NEGOTIATION_IN_PROGRESS`: One or more counter-offers active.
  4. `ASSIGNED`: Worker assigned, agreed price locked.
  5. `ON_THE_WAY`: Worker dispatched to customer premises (optional geolocation tracking).
  6. `ARRIVED`: Worker on site.
  7. `WORK_STARTED`: Work underway (safety OTP verification recommended).
  8. `WORK_COMPLETED`: Worker marks task completed and uploads proof/invoice.
  9. `PAYMENT_PENDING` / `PAID`: Payment processed (cash or online).
  10. `CONFIRMED_COMPLETED`: Customer confirms satisfaction or 24-hour auto-closure window expires.
  11. `CANCELLED`: Terminal state prior to work start with cancellation audit record.
  12. `DISPUTED`: Flagged for support intervention.
- **5.2 State Transition Authorization [CONFIRMED]:**
  Every transition is strictly governed by actor role (Customer, Worker, Admin, or System Cron).

### Module 6: Worker Operations & Dashboard
- **6.1 Onboarding & Verification [CONFIRMED]:**
  - Worker registers, sets skills/categories, uploads identity document (e.g., Aadhaar/Govt ID) and trade certificate.
  - Account status defaults to `UNVERIFIED`. Public profile cannot display `verified` badge until administrative review and background check approval.
- **6.2 Availability Control [CONFIRMED]:**
  - Global `is_online` toggle switch.
  - When `is_online = false`, worker is excluded from instant broadcast dispatches and directory searches for immediate slots.
  - Weekly schedule matrix for recurring calendar booking slots.
- **6.3 Real-Time Dashboard Metrics [CONFIRMED]:**
  - **Today's Earnings:** Sum of net earnings from jobs completed between `00:00:00` and `23:59:59` local time today.
  - **Active Jobs:** Count of jobs in `ASSIGNED`, `ON_THE_WAY`, `ARRIVED`, or `WORK_STARTED`.
  - **Pending Requests:** Count of unexpired requests awaiting worker's response.
  - **Completed Jobs:** Total lifetime jobs successfully closed.
  - **Average Rating:** Weighted arithmetic mean of all non-deleted reviews.
  - **Average Response Time:** Rolling 30-day mean elapsed seconds between request creation and worker response.

### Module 7: Financials, Earnings & Payouts
- **7.1 Financial Ledger Architecture [CONFIRMED]:**
  - Double-entry ledger tracking all transactions: Gross Service Fee, Platform Commission (e.g., 10-15%), Payment Gateway Fee, Net Worker Earning, and Taxes (GST/TDS).
- **7.2 Earnings Distinction [CONFIRMED]:**
  - Distinguish between **Earned Revenue** (job completed and confirmed) vs **Settled / Paid Out** (funds transferred to worker's verified bank account).
  - Payout batches run on scheduled cycles (e.g., T+2 days or weekly) after checking for open customer disputes.

### Module 8: Messaging & Notifications
- **8.1 In-App Conversations [CONFIRMED]:**
  - Contextual conversations scoped 1-to-1 per booking.
  - Participants restricted to the assigned customer and assigned worker (plus system/support admins).
  - Real-time message synchronization with read receipts.
- **8.2 System Notifications [CONFIRMED]:**
  - Persistent inbox notifications paired with real-time push/in-app toasts for critical events:
    - New request broadcast, counter-offer received, offer accepted/rejected, worker on the way, work completed, payment received, review received.

### Module 9: Ratings & Reviews
- **9.1 Eligibility & Integrity [CONFIRMED]:**
  - Reviews permitted exclusively for customers who completed a booking with the assigned worker.
  - Unique constraint: Maximum 1 review per `booking_id`.
  - Star rating (1 to 5) + optional feedback tags (e.g., Punctual, Clean Work, Fair Price) + written comment.
  - Worker reply capability (1 public reply allowed per review).
  - Moderation queue for reported abusive or defamatory reviews.

---

## 5. Unresolved Business Decisions Requiring Stakeholder Clarification

| Decision Code | Issue Description | Proposed Architecture Default | Stakeholder Action |
| :--- | :--- | :--- | :--- |
| **DEC-01** | **Dispatch Strategy:** Does Serviq prioritize Direct Worker Booking or Broadcast to Nearby Pool? | Hybrid: Support both. Customer can pick an individual worker or click "Request Nearby Help" to broadcast. | Needs approval on launch default. |
| **DEC-02** | **Payment Collection Model:** When does payment occur? (Pre-payment escrow vs Post-completion vs Cash-on-Delivery). | Post-completion online payment or Cash on Delivery (COD) with worker platform-fee debit from wallet. | Needs commercial model decision. |
| **DEC-03** | **Platform Commission Rate:** What percentage does Serviq charge? | 10% platform fee deducted from worker gross payout. | Confirm commission percentage. |
| **DEC-04** | **Cancellation Fee Policy:** Does customer pay a penalty if cancelling after worker is `ON_THE_WAY`? | Flat ₹100 cancellation fee credited to worker if cancelled > 10 min after dispatch. | Confirm fee structure. |
| **DEC-05** | **Parts & Materials Handling:** How are extra hardware/parts costs billed? | Worker creates an in-app "Extra Expense" add-on with receipt image, requiring customer 1-click in-app approval. | Approve material add-on flow. |
