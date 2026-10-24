# SERVIQ — Edge Cases & Operational Failure Modes

**Document Version:** 1.0.0  
**Target Domain:** Fault Tolerance, Concurrency Protection & Conflict Resolution  

---

## 1. Concurrency & Race Conditions

### 1.1 Two Workers Accepting the Same Broadcast Booking Simultaneously
- **Scenario:** Customer broadcasts job `SQ-1048`. Worker A and Worker B both tap "Accept Job" within 50 milliseconds of each other.
- **Risk:** Double-assignment, where both workers believe they have secured the job and travel to the customer's home.
- **Technical Resolution:**
  - Fastify handles Worker A's request inside a transaction with `SELECT * FROM bookings WHERE id = 'SQ-1048' FOR UPDATE`.
  - Worker A's transaction succeeds: status updates from `REQUEST_SUBMITTED` to `ASSIGNED`, `assigned_worker_id = Worker A`.
  - Worker B's transaction unblocks. It reads the updated status (`ASSIGNED`).
  - The application detects that `status !== 'REQUEST_SUBMITTED'`, immediately rolls back Worker B's transaction, and returns HTTP 409 Conflict:
    ```json
    {
      "success": false,
      "error": {
        "code": "JOB_ALREADY_CLAIMED",
        "message": "This job was just claimed by another professional."
      }
    }
    ```
- **UI Experience:** Worker A receives a success toast and transitions to the Active Job screen. Worker B receives an informational toast: *"This job was just accepted by another nearby professional"*, and the card smoothly fades out from their incoming request feed.

---

### 1.2 An Offer Expiring While the Customer Is Viewing the Screen
- **Scenario:** Worker submits a counter-offer of ₹450 with a 15-minute expiration window. The customer deliberates for 14 minutes and 58 seconds and taps "Accept Offer" at minute 15:02.
- **Risk:** Stale offer acceptance after the worker has moved on to another task.
- **Technical Resolution:**
  - Background BullMQ job fires at minute 15:00, setting `job_offers.status = 'EXPIRED'`.
  - When the customer's accept request arrives at 15:02, the server verifies `expires_at > CURRENT_TIMESTAMP AND status = 'PENDING'`.
  - The check fails. The server rejects the mutation with HTTP 410 Gone (`OFFER_EXPIRED`).
  - Concurrently, the WebSocket channel had emitted `offer:expired` to the client.
- **UI Experience:** The modal disables the accept button and displays: *"This offer has expired. You can request a fresh quote or broadcast to other nearby professionals."*

---

### 1.3 Duplicate Requests Caused by Repeated Rapid Clicks
- **Scenario:** Impatient customer taps "Send Booking Request" 4 times in rapid succession on an unstable cellular network.
- **Risk:** Creation of 4 duplicate bookings, flooding nearby workers with multiple identical requests.
- **Technical Resolution:**
  - **Frontend:** Debounced submit button with immediate visual `isSubmitting = true` disabled state and loading spinner.
  - **Backend Idempotency:** The frontend generates a client-side UUID (`idempotencyKey = uuidv4()`) on form initialization and sends it in the `Idempotency-Key` header.
  - The backend stores `idempotency:booking:<key>` in Redis with a 60-second atomic lock. Subsequent clicks with the same key return the in-flight or cached response.

---

### 1.4 Network Failure During Offer Acceptance
- **Scenario:** Customer taps "Accept Offer". The database transaction commits successfully on the server, but the customer's phone enters a tunnel and loses 4G connectivity before receiving the HTTP 200 response.
- **Risk:** Customer believes the request failed and retries or closes the app, while the worker is already dispatched.
- **Technical Resolution:**
  - When the customer's app reconnects, the WebSocket client reconnects and issues `sync:active_bookings`.
  - The server returns the authoritative state: `SQ-1048` is in status `ASSIGNED`.
  - In addition, an SMS notification is dispatched: *"Your booking SQ-1048 is confirmed with Ramesh Patil."*
- **UI Experience:** The app detects the active state on reconnect and routes the customer directly to the Active Booking tracking view.

---

## 2. Booking Lifecycle Edge Cases

### 2.1 Customer Cancels After Worker Has Accepted
- **Scenario:** Booking is in status `ASSIGNED` or `ON_THE_WAY`. The customer decides they no longer need the repair and taps "Cancel".
- **Business Rule & Policy:**
  - If cancelled within **5 minutes** of assignment: Free cancellation, zero penalty.
  - If cancelled after 5 minutes or while worker is `ON_THE_WAY`: Customer is charged a **₹100 Cancellation / Trip Fee**.
- **Technical Resolution:**
  - Status updates to `CANCELLED`.
  - `booking_status_history` records `cancellation_reason` and actor.
  - Worker's ledger receives a credit of ₹85 (₹100 minus ₹15 platform handling fee) as compensation for travel time.
  - Real-time socket alert sent to worker: *"Booking SQ-1048 was cancelled. A trip fee of ₹85 has been credited to your earnings."*

---

### 2.2 Worker Goes Offline or Unassigns After Accepting a Job
- **Scenario:** Worker accepts a job for 4:00 PM, but at 3:30 PM toggles availability offline or taps "Cannot Attend".
- **Risk:** Customer is left waiting with no service fulfillment.
- **Technical Resolution:**
  - Worker cannot simply toggle offline while having an active `ASSIGNED` job without formally initiating an unassignment flow.
  - If worker clicks "Cancel Job / Cannot Attend", system enforces:
    1. Worker profile reliability score decreases (internal metrics penalty).
    2. Booking status transitions from `ASSIGNED` back to `REQUEST_SUBMITTED`.
    3. System immediately auto-broadcasts the request with high priority (`is_urgent = true`) to all nearby online workers within radius.
    4. Customer receives an immediate push notification: *"Your professional had an emergency. We are re-routing your request to nearby top-rated professionals right now."*

---

### 2.3 Worker Fails to Arrive (No-Show)
- **Scenario:** Scheduled time is 11:00 AM. Status is `ON_THE_WAY` or `ASSIGNED`. At 11:30 AM, worker has not arrived and is unresponsive to phone/chat.
- **Technical Resolution:**
  - Customer taps "Worker Has Not Arrived" button (active 15 mins after scheduled slot).
  - System verifies worker's GPS coordinates: if worker is > 2 km away, system flags the booking as `WORKER_NO_SHOW`.
  - Customer can cancel with **zero penalty** or request instant 1-click replacement.
  - Worker account is flagged for review; repeated no-shows trigger automated temporary account suspension.

---

### 2.4 Booking Rescheduling
- **Scenario:** Customer or worker needs to change the service appointment time.
- **Technical Resolution:**
  - Initiating party selects new date and time slot (`POST /api/v1/bookings/:id/reschedule-request`).
  - Booking enters `RESCHEDULE_PENDING`.
  - Counterparty receives prompt to "Accept New Time" or "Decline".
  - If accepted, `scheduled_start_time` is updated. If declined, the original time remains active or either party can cancel subject to standard cancellation rules.

---

## 3. Financial, Dispute & Security Edge Cases

### 3.1 Customer Disputes Completed Work or Refuses to Pay
- **Scenario:** Worker marks `WORK_COMPLETED`. Customer claims the repair was substandard, damaged a pipe, or the worker did not finish the job.
- **Technical Resolution:**
  - Customer taps "Dispute Job" instead of paying / confirming.
  - Booking status transitions to `DISPUTED`.
  - Customer is prompted to submit: (a) Explanation, (b) Photos of the work.
  - Worker's payout for this specific booking is placed on temporary hold.
  - Dispute ticket is automatically routed to the Admin / Support Dashboard (`/api/v1/admin/disputes`).
  - Support agent reviews chat transcript, initial problem description, worker completion photos, and arbitrates (partial refund, full refund, or release payout to worker).

---

### 3.2 Post-Payment Refund
- **Scenario:** Customer paid ₹450 online via UPI, but a dispute subsequently resolved in customer's favor.
- **Technical Resolution:**
  - Admin issues refund via `/api/v1/admin/bookings/:id/refund`.
  - Backend calls Payment Gateway Refund API (`payment_gateway.refunds.create()`).
  - `payments.status` updates to `REFUNDED`.
  - Worker ledger records a debit entry `ADJUSTMENT` offsetting the previously recorded job earning.
  - Customer receives automated email/SMS confirmation with bank UTR reference.

---

### 3.3 Customer Deletes or Deactivates Account
- **Scenario:** Customer requests account deletion under GDPR / right to be forgotten.
- **Technical Resolution:**
  - Pre-condition Check: Customer cannot delete account if they have an active booking (`ASSIGNED`, `ON_THE_WAY`, `WORK_STARTED`) or an unpaid balance.
  - If clear:
    1. `users.status = 'DEACTIVATED'`.
    2. Personal identifiable information (PII) is anonymized: `first_name = 'Deleted'`, `last_name = 'Customer'`, `phone_number = 'DELETED_' || id`, `email = null`.
    3. Addresses are hard deleted.
    4. Past financial transactions (`payments`, `bookings` metadata) are **retained in anonymized form for 7 years** to fulfill legal tax and accounting statutory requirements.

---

### 3.4 Worker Suspended While Bookings Are Active
- **Scenario:** Platform administrator suspends a worker for code-of-conduct violations while the worker has 1 active job for tomorrow and 2 pending requests.
- **Technical Resolution:**
  - Admin triggers `/api/v1/admin/workers/:id/suspend`.
  - Worker's refresh token is revoked in Redis; current JWT is blacklisted.
  - Pending offers submitted by this worker are marked `CANCELLED`.
  - For active future bookings: System automatically reassigns the booking to the Broadcast Pool with urgent status and notifies customers.
