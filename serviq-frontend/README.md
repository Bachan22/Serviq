# Serviq — Hyperlocal On-Demand Blue-Collar Services Platform

Serviq is a modern, responsive web application built with React, Vite, and Fastify, connecting homeowners and residents with vetted, local trade professionals (plumbers, electricians, cleaners, painters, and more).

---

## 🚀 Getting Started

### 1. Frontend Setup
```bash
cd serviq-frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

Production build check:
```bash
npm run build
```

### 2. Backend Setup
```bash
cd serviq-backend
npm install
npm run dev
```
API runs on `http://localhost:5000/api/v1`.

Run automated auth & role test suite:
```bash
npx vitest run tests/auth-system.test.ts
```

---

## 🔑 Pre-seeded Demo Accounts

For rapid testing and evaluation, the platform includes two pre-configured accounts:

| Role | Email | Password | Pre-seeded Details |
|---|---|---|---|
| **Customer** | `customer.demo@serviq.test` | `Serviq2026!` | Gurubachan Singh • Bhayandar West, Mumbai |
| **Worker (Pro)** | `worker.demo@serviq.test` | `Serviq2026!` | Ramesh Patil • Master Plumber • ₹350/hr • Pending Verification |

*Both login and registration forms also include one-click demo account filler pills.*

---

## 🛡️ Architecture & Role Security

### 1. Strict Role Boundaries
- **Immutable Role**: A user selects their role once at sign-up (`customer` or `worker`). Roles cannot be modified after account creation.
- **Route Guards (`RequireAuth`, `RequireRole`)**:
  - Unauthenticated access to `/customer/*` or `/worker/*` redirects to `/login` with a `returnTo` state.
  - A Customer attempting to access `/worker/*` is immediately redirected to `/customer`.
  - A Worker attempting to access `/customer/*` is immediately redirected to `/worker`.
  - Foreign navigation menus and layouts are never mounted for the opposite role.
- **Header Isolation**: The old preview role switcher has been completely removed. Customer and Worker each have distinct headers and product shells.

### 2. Rate Limiting & Abuse Protection
- **Login Lockout**: 5 consecutive failed login attempts locks further attempts for 15 minutes. The UI displays an active countdown (`Try again in 14:32`). Repeated lockouts progressively double the lock window.
- **Generic Error Messages**: Failed credentials always respond with `"Incorrect email or password."`, never disclosing whether the email exists.
- **Honeypot Bot Defense**: A hidden `website` field rejects automated submissions.
- **Sign Up Throttle**: Max 5 registrations per IP per hour (returns HTTP 429).
- **Forgot Password Protection**: Max 3 requests per email per hour. Always returns the neutral message: `"If this email exists, we have sent a reset link."`
- **Audit Logging**: Every auth event (`signup`, `login_success`, `login_failure`, `lockout`) is recorded without storing passwords.

---

## 🧪 Manual QA Verification Checklist

Use this checklist to verify all requirements:

- [x] **1. Role-Tailored Sign-up:**
  - Visit `/signup`.
  - Step 1 presents two distinct cards: "I need a service" (Customer) and "I offer services" (Worker).
  - Clicking "I need a service" leads to the Customer form with full name, email, 10-digit Indian phone (`+91`), password meter, and terms.
  - Clicking "Change role" returns cleanly to Step 1.
  - Clicking "I offer services" leads to the Worker form with primary trade skill, years of experience, service area, and base rate in INR.
  - Submitting as Customer immediately lands on `/customer`. Submitting as Worker immediately lands on `/worker`.

- [x] **2. Worker Verification Pending Banner:**
  - Log in as `worker.demo@serviq.test`.
  - Notice the amber banner across the top: *"Verification pending: Your profile is currently under review by our onboarding team..."*
  - Verify the worker can freely browse their workspace, review job requests, and navigate to `/worker/rates`.

- [x] **3. Role Route Guard Enforcement:**
  - While logged in as `customer.demo@serviq.test`, manually enter `http://localhost:5173/worker` in the browser URL bar.
  - Notice you are immediately bounced back to `/customer`.
  - While logged in as `worker.demo@serviq.test`, navigate to `http://localhost:5173/customer`.
  - Notice you are immediately bounced back to `/worker`.

- [x] **4. Rate Limiting & Lockout Countdown:**
  - Go to `/login`.
  - Enter `customer.demo@serviq.test` with an incorrect password 5 times in a row.
  - On the 5th attempt, verify the security banner appears: *"Account temporarily locked after 5 failed attempts. Try again in 14:59."* with a live second-by-second countdown.
  - Verify the submit button is locked during this period.

- [x] **5. Rate Limiting on Forgot Password:**
  - Go to `/forgot-password`.
  - Submit the same email 3 times. On the 4th request, verify that HTTP 429 rate limit is returned.
  - Verify the response always displays: *"If this email exists, we have sent a reset link."*

- [x] **6. Session Persistence & Logout:**
  - Refresh the browser on `/customer` or `/worker`. Notice the session stays authenticated.
  - Click your avatar or the sidebar **Sign out** button.
  - Notice you are redirected to `/login`, and navigating back to `/customer` redirects back to `/login`.

---

## 🌐 Deploying to Vercel

The application is fully configured for Vercel deployment:

1. **SPA Rewrites**:
   `vercel.json` is included to handle client-side routing and prevent 404s on deep links:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

2. **Environment Variables**:
   Configure the following in the Vercel Dashboard (*Project Settings > Environment Variables*):
   - `VITE_API_BASE_URL`: URL of your deployed Fastify backend (e.g. `https://api.serviq.app/api/v1`).
     *(If the backend is not deployed, the frontend automatically uses its built-in resilient client storage engine).*

3. **Deploy via Vercel CLI**:
   ```bash
   cd serviq-frontend
   vercel
   ```

---

## 📊 Dynamic Data Layer & Demo Seed Management

Serviq has removed all hard-coded mock arrays and fake static figures from all user-facing views. All data (earnings, reviews, ratings, matching jobs, counts, and badges) is dynamically computed and strictly scoped per authenticated user. Brand new accounts always see a clean, honest empty state with zeros.

### 1. Demo Data Seeding & Isolation
Demo data is safely isolated using the `is_demo: true` attribute. Real registered users are never attached to demo records.

- **Seed Demo Data** (15 verified professionals in Bhayandar/Mira Road, demo jobs, and demo reviews):
  ```bash
  # In frontend:
  npm run seed

  # In backend:
  npm run seed
  ```
- **Clean Demo Data** (removes all records where `is_demo: true`):
  ```bash
  # In frontend:
  npm run seed:clean

  # In backend:
  npm run seed:clean
  ```
- **Environment Control**:
  Set `ENABLE_DEMO_DATA=true` to enable demo accounts in development environments. Defaults to `false` in production.

### 2. 10-Point Data Integrity Verification Suite
Run the automated end-to-end data integrity test:
```bash
node scripts/verify-10-steps.js
```
This tests all 10 requirements:
1. New worker clean empty state (Rs 0 earnings, 0 completed jobs, "New" rating, empty chart, checklist).
2. Targeted skill matching (AC worker sees AC job with badge 1; plumber does not).
3. Plumbing job matched to plumber, hidden from AC worker.
4. Haversine distance filtering (distant jobs > radius excluded).
5. Accept/counter workflow and Active jobs transition.
6. Job completion, payout ledger credit, and 5-star review calculation.
7. Worker privacy scoping (second worker cannot see first worker's reviews or earnings).
8. Online/offline toggle behavior (offline worker receives no requests).
9. Customer home real counts and honest empty state.
10. Complete codebase audit confirming zero mock arrays or persona strings in UI files.

---

## 🗺️ Google Maps Provider Setup & Hardening

Serviq features a Map-First Hero with a modular provider abstraction:
- **Default / Fallback**: Uses Leaflet and OpenStreetMap tiles automatically whenever `VITE_GOOGLE_MAPS_API_KEY` is omitted or unavailable.
- **Production / Google Maps**: Uses Google Maps JavaScript API with official loader and `AdvancedMarkerElement`.

### 1. Creating and Securing Your Google Maps API Key
1. **Create Key**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **Credentials**.
   - Click **Create Credentials** > **API key**.
2. **API Restrictions**:
   - Under *API restrictions*, choose **Restrict key**.
   - Enable **Maps JavaScript API** (and optionally **Geocoding API**).
   - Do NOT enable unrestricted access.
3. **Application / HTTP Referrer Restrictions**:
   - Under *Application restrictions*, select **Websites (HTTP referrers)**.
   - Add your authorized website domains:
     - `http://localhost:5173/*`
     - `http://localhost:*/*`
     - `https://your-serviq-deployment.vercel.app/*`
     - `https://*.vercel.app/*`
4. **Quotas and Billing Alerts**:
   - Navigate to **Billing** > **Budgets & alerts** and set a monthly alert (e.g., $10 or $25).
   - Under **APIs & Services** > **Maps JavaScript API** > **Quotas**, set a daily cap to prevent unexpected surges.
5. **Create a Map ID for Vector Styling & Advanced Markers**:
   - Go to **Map Management** > **Create Map ID**.
   - Map Type: **JavaScript**, Raster/Vector: **Vector**.
   - Copy your Map ID.

### 2. Configuring Environment Variables in Vercel
In your Vercel Dashboard (*Project Settings > Environment Variables*):
- `VITE_GOOGLE_MAPS_API_KEY`: Your restricted Google Maps API Key.
- `VITE_GOOGLE_MAP_ID`: Your created Map ID.
- Re-deploy to activate. When these keys are absent, the platform automatically and gracefully runs on the Leaflet fallback with identical custom avatars, pills, user pulse, and radius circles.

