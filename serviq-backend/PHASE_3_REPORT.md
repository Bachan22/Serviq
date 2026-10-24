# SERVIQ — Phase 3 Implementation Report: Payments, Worker Wallet & Platform Settlement Engine

**Status:** Completed & Validated  
**Database:** PostgreSQL 18 + PostGIS 3.6  
**Test Suite Results:** 60 / 60 tests passing (100% pass rate across 4 test suites)  
**TypeScript Build:** Clean (0 errors)

---

## 1. Executive Summary

Phase 3 introduces the financial settlement, commission accounting, and worker wallet infrastructure for Serviq:

1. **Labor-Only Commission Engine:** Platform commission of 10% is calculated strictly on **Labor Charges only** (`agreed_labor_price`). Hardware and parts costs (`agreed_parts_price`) incur 0% commission, preserving transparent unit economics for service professionals.
2. **Cash on Delivery (COD) Reconciliation:**
   - When customer pays the worker cash on-site, the worker keeps the entire cash collected.
   - Platform automatically debits the 10% platform commission from the worker's digital wallet (`COMMISSION_DEDUCTION`).
   - The worker's wallet balance can operate in the negative down to a configurable safety limit (`WALLET_MAX_NEGATIVE_LIMIT = -₹1500`).
   - If negative balance exceeds `-₹1500`, the wallet is marked `isFrozen = true` and dispatch is paused until the worker recharges.
3. **Online Payments & Payouts:**
   - Online payments (UPI, Card) collect the full customer payment directly.
   - Platform automatically credits the worker's wallet with their net earnings (`ONLINE_PAYOUT` = labor after commission + parts).
4. **Worker Wallet Top-Up:** Workers can top up their wallet balance (e.g. ₹300, ₹1000) via UPI to clear negative commission dues or maintain active credit.
5. **Withdrawal Payout Requests:** Workers can request payouts of their positive earnings to UPI IDs or bank accounts, with balance verification and status tracking.

---

## 2. Database Schema & Migration Changes

Migration `0003_worthless_la_nuit.sql` established 4 new financial tables and 3 indexes:

### 2.1 Tables
- **`wallets`**: `id` (UUID PK), `worker_id` (FK -> `worker_profiles`, unique), `current_balance`, `locked_balance`, `total_earned`, `total_commission_paid`, `is_frozen`, timestamps.
- **`wallet_transactions`**: `id` (UUID PK), `wallet_id` (FK -> `wallets`), `booking_id` (nullable FK -> `bookings`), `transaction_type` (`COMMISSION_DEDUCTION`, `CANCELLATION_COMPENSATION`, `ONLINE_PAYOUT`, `WALLET_TOPUP`, `WITHDRAWAL`), `amount`, `balance_before`, `balance_after`, `reference_id`, `description`, `created_at`.
- **`payments`**: `id` (UUID PK), `booking_id` (FK -> `bookings`), `customer_id` (FK -> `customer_profiles`), `amount`, `payment_method` (`CASH_ON_DELIVERY`, `ONLINE_UPI`, `ONLINE_CARD`), `gateway_payment_id`, `status` (`PENDING`, `SUCCESS`, `FAILED`), `labor_amount`, `parts_amount`, `platform_commission`, `worker_payout_amount`, `settled_at`, timestamps.
- **`payout_requests`**: `id` (UUID PK), `worker_id` (FK -> `worker_profiles`), `amount`, `status` (`REQUESTED`, `PROCESSING`, `COMPLETED`, `REJECTED`), `payout_method` (`UPI`, `BANK_TRANSFER`), `payout_details` (JSONB), `transaction_ref`, `processed_at`, timestamps.

### 2.2 Performance Indexes
- `idx_wallet_transactions_wallet`: `(wallet_id, created_at)`
- `idx_payments_booking`: `(booking_id)`
- `idx_payout_requests_worker`: `(worker_id, status)`

---

## 3. API Endpoints Reference

### 3.1 Worker Wallet Endpoints (`/api/v1/wallets`)
- `GET /api/v1/wallets/me` — Worker retrieves wallet balance, frozen status, and remaining negative credit limit.
- `POST /api/v1/wallets/me/topup` — Worker recharges wallet balance.
- `POST /api/v1/wallets/me/payouts` — Worker requests withdrawal payout.
- `GET /api/v1/wallets/me/payouts` — Lists past withdrawal payout requests.
- `GET /api/v1/wallets/me/transactions` — Full audit ledger of wallet credits, debits, and commission deductions.

### 3.2 Payment & Settlement Endpoints (`/api/v1/payments`)
- `POST /api/v1/payments/process` — Process and settle job payment.
- `GET /api/v1/payments/booking/:bookingId` — Retrieves payment receipt and commission breakdown.

---

## 4. Automated Test Suite Results

All 60 tests run against real PostgreSQL 18 + PostGIS 3.6:

```
> vitest run --fileParallelism=false

 ✓ tests/catalog-discovery.test.ts (27 tests) 539ms
 ✓ tests/booking-negotiation.test.ts (16 tests) 336ms
 ✓ tests/payments-wallet.test.ts (8 tests) 215ms
 ✓ tests/auth.test.ts (9 tests) 64ms

 Test Files  4 passed (4)
      Tests  60 passed (60)
   Duration  7.22s
```

### Verified Test Cases:
1. **Wallet Initialization:** Auto-created with ₹0 balance, -₹1500 negative credit limit, and unfrozen state.
2. **Labor-Only Commission:** On a ₹700 job (₹500 labor + ₹200 parts), 10% commission of ₹50 is deducted strictly on labor; parts incur ₹0 commission.
3. **COD Balance Adjustment:** Deducts ₹50 from worker wallet, transitioning balance to -₹50.
4. **Top-Up Flow:** Top-up of ₹300 transitions balance from -₹50 to +₹250.
5. **Online Payment:** Total ₹1400 (₹1000 labor + ₹400 parts) collects online, retains ₹100 platform commission, and credits worker with +₹1300.
6. **Withdrawal Payout:** Worker withdraws ₹500 via UPI; balance reduces from ₹1550 to ₹1050.
7. **Over-Withdrawal Guard:** Withdrawing more than available positive balance returns `400 Bad Request`.
8. **Negative Limit Freeze Guard:** Balances exceeding `-₹1500` automatically flip `isFrozen = true`.

---

## 5. Frontend Client Modules

Modular API modules added in [`serviq-frontend/src/api/`](file:///c:/Users/Gurubachan%20Singh/Downloads/serviq-frontend/serviq-frontend/src/api/):
- [`wallet.js`](file:///c:/Users/Gurubachan%20Singh/Downloads/serviq-frontend/serviq-frontend/src/api/wallet.js): Wallet summary, top-up, payout requests, ledger transaction history.
- [`payment.js`](file:///c:/Users/Gurubachan%20Singh/Downloads/serviq-frontend/serviq-frontend/src/api/payment.js): Payment settlement (COD and Online), receipt retrieval.
- [`index.js`](file:///c:/Users/Gurubachan%20Singh/Downloads/serviq-frontend/serviq-frontend/src/api/index.js): Centralized export for all domain APIs.

---

## 6. Complete Roadmap Status

| Phase | Description | Status |
| :--- | :--- | :--- |
| **Phase 0** | Project Setup, Fastify, PostGIS, Auth & Session Architecture | Completed & Verified (9 tests) |
| **Phase 1** | Service Catalog, Customer/Worker Profiles, Saved Addresses, Hyperlocal Search | Completed & Verified (27 tests) |
| **Phase 2** | Dual Dispatch (Direct/Broadcast), Pessimistic Locking, Bounded Negotiation, Cancellation Policy | Completed & Verified (16 tests) |
| **Phase 3** | Payments, Commission Engine (Labor-Only), Worker Wallet, COD Negative Limits & Top-ups | Completed & Verified (8 tests) |
| **Total** | Complete End-to-End Core Backend Engine | **60 / 60 Tests Passing** |
