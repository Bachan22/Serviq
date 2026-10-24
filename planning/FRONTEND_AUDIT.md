# SERVIQ — Comprehensive Frontend Codebase Audit

**Document Version:** 1.0.0  
**Target Repository:** `serviq-frontend` (React 18 + Vite + Lucide Icons)  
**Audit Date:** Current System State  

---

## 1. Executive Summary of Existing Frontend

The current frontend implementation is a clean, single-bundle prototype (`App.jsx` + `styles.css`) delivering the **Minimal Neutral + Amber** visual identity. It features a functioning dual-role preview mechanism ("Customer" vs "Worker"), rich micro-interactions, responsive styling across breakpoints (desktop, tablet, mobile), and simulated state workflows.

However, the application is **entirely client-side and ephemeral**:
- There is **no routing library** (e.g., React Router); page switching is handled via local `useState('Home')`.
- There is **no persistent backend, API client, or database connection**.
- All data (workers, categories, bookings, messages, reviews, earnings charts) is hardcoded or stored in local component state, resetting completely upon browser refresh.
- The dual-role toggle in the top bar is a UI presentation toggle, not a secure authentication/role mechanism.

---

## 2. Structural & Component Audit

### 2.1 File Architecture
- `index.html`: Web font links (`Manrope`, `DM Sans`), viewport meta tags, dark theme color (`#0F1115`).
- `src/main.jsx`: Standard React 18 `createRoot` entry mounting `<App />` within `React.StrictMode`.
- `src/styles.css` (41.9 KB): Comprehensive CSS design system defining tokens (`--ink`, `--amber`, `--muted`, `--line`, `--surface`, `--bg`, `--green`, `--blue`, `--shadow`), utility classes, modal animations, toast transitions, and media queries (`1500px`, `1200px`, `900px`, `620px`, `prefers-reduced-motion`).
- `src/App.jsx` (38.1 KB): Monolithic component containing app shell, global states, modal handlers, sub-views, and UI components.

### 2.2 Shell Components & Navigation
| Component / Element | Visible Role | Trigger / Action | Current Behavior | Required Backend Transition |
| :--- | :--- | :--- | :--- | :--- |
| **Brand Logo** (`serviq.`) | Both | Click | Resets role to `customer` and page to `Home` | Route to authenticated dashboard home based on user token |
| **Location Selector** | Both | Click (Static) | Displays "Bhayandar, Mumbai" (Hardcoded) | Geolocation API / Saved Customer Address Dropdown |
| **Demo Switch** | Both | Click Customer / Worker | Changes `role` state, resets page to `Home`/`Dashboard` | **Must be eliminated in production**; replace with JWT Auth and Role Guard |
| **Notification Bell** | Both | Click | Triggers mock toast: *"You’re all caught up in this demo."* | Unread count badge; dropdown fetching `/api/v1/notifications` |
| **Top Profile Avatar** | Both | Click | Navigates to `Profile & settings` | Popover with User Info, Account Settings, Switch Mode (if dual account), Sign Out |
| **Mobile Hamburger** | Both | Click | Toggles `.sidebar.open` overlay | Same UI interaction, wired to dynamic route links |
| **Sidebar Navigation** | Customer | Click Nav Items | Changes `page` state (`Home`, `Explore`, `Bookings`, etc.) | Client-side routing with deep links (`/explore`, `/bookings`, `/messages`) |
| **Sidebar Navigation** | Worker | Click Nav Items | Changes `page` state (`Dashboard`, `Requests`, `Active`, etc.) | Client-side routing (`/worker/dashboard`, `/worker/requests`, etc.) |
| **Sign Out Button** | Both | Click | Displays demo toast: *"Sign out will be connected later."* | POST `/api/v1/auth/logout`, clears session cookies/storage, redirects to login |

---

## 3. Customer-Facing Screens Audit

### 3.1 Customer Home (`page === 'Home'`)
- **Hero Card:**
  - Content: Headline *"Good help. Right around the corner."*, trust badges (Verified professionals, 4.8 average rating).
  - Visual: CSS house illustration, orbit geometry, floating badges with mock worker avatars (`RP`, `SK`, `AM`).
  - Hardcoded Values: All ratings and worker counts are static markup.
- **Home Search Bar:**
  - Inputs: Service location indicator + search input with Enter key handler.
  - Action: Clicking "Find help" or pressing Enter navigates to `Explore services`.
  - Backend Requirement: Autocomplete search endpoint `/api/v1/services/search?q=...&lat=...&lng=...`.
- **Category Grid:**
  - Displays 6 categories: Plumbing (24), Electrical (18), Cleaning (32), Painting (12), AC repair (9), Carpentry (15).
  - Action: Clicking a category filters workers and sets active pill.
  - Backend Requirement: Fetch dynamic categories and live provider counts via `/api/v1/services/categories`.
- **Local Favourites (Worker Grid):**
  - Displays top 3 mock workers from array (`Ramesh Patil`, `Suresh Kumar`, `Amit More`).
  - Card elements: Avatar initials, verified badge, rating (`4.9 (128)`), distance (`1.2 km away`), typical visit starting price (`₹350`), Save heart button, "Book now" button.
  - Local State: Liking a worker appends `id` to `liked` state array.
  - Backend Requirement: Query `/api/v1/workers/search?featured=true` with real distance calculation via PostGIS.

### 3.2 Explore Services (`page === 'Explore services'`)
- **Search & Filter Bar:**
  - Live filtering against `workers` array via `useMemo` comparing name, job, and category.
  - Category selector triggers category filter.
  - Backend Requirement: Debounced server-side search with faceted filters (distance, rating, price, verified).
- **Empty State:**
  - Shows `.empty-inline` when `filteredWorkers.length === 0`.

### 3.3 Booking Modal (`modal === 'booking'`)
- **Trigger:** Clicking "Book now" on any worker card or category.
- **Form Controls:**
  - Displays selected worker card (Avatar, name, rating, job, starting price).
  - Category dropdown (`<select>` populated from categories).
  - Preferred day dropdown (`Today`, `Tomorrow`, `This weekend`).
  - Preferred time dropdown (`As soon as possible`, `Morning`, `Afternoon`, `Evening`).
  - Service address text input (default: `"Bhayandar West, Mumbai"`).
  - Issue description textarea (`"What needs fixing?"` - optional).
- **Current Behavior on Submit (`confirmBooking`):**
  - Synthesizes object `{ id: 'SQ-1050', title, worker, date, time, price, status: 'Request sent' }`.
  - Appends to local `bookings` array in memory.
  - Closes modal, shows toast, redirects to `My bookings`.
- **Deficiencies & Backend Requirements:**
  - No client-side validation schema (can submit empty address or invalid time).
  - No image/photo upload for damaged parts/fixtures.
  - Price is pinned to worker's base rate; no negotiation or budget specification field.
  - Must connect to `POST /api/v1/bookings`.

### 3.4 My Bookings (`page === 'My bookings'`)
- **Stats Row:** StatCard widgets for "Total bookings", "In progress" (hardcoded to 1), "Completed" (hardcoded to 8).
- **Bookings Table:**
  - Merges hardcoded demo booking (`SQ-1038`, Bathroom tap inspection, Ramesh Patil, In progress) with local `bookings` array.
  - Columns: Service, Professional, Schedule, Amount, Status tag (`In progress` -> blue, `Request sent` -> warning).
- **Gaps:**
  - No detail view or tracking drawer for active bookings.
  - No cancel booking button or action menu.
  - No "Pay Now" or "Review Worker" actions on completed rows.
  - Backend Requirement: `GET /api/v1/bookings` with filtering by status.

### 3.5 Messages Page (`page === 'Messages'`)
- **Layout:** Two-column split view (Conversation list on left, chat messages on right).
- **Conversation List:** Two hardcoded items (`Ramesh Patil`, `Suresh Kumar`). Clicking Suresh shows toast *"This sample conversation is not connected..."*.
- **Chat Window:** Hardcoded message history between customer and Ramesh Patil.
- **Compose Bar:**
  - Text input + Send button: Appends message to local `sent` state array.
  - Attachment (`+`) button: Shows toast *"File sharing will be available after backend integration."*
  - Phone call button: Shows toast *"Calling will be added with backend integration."*
- **Backend Requirement:** `GET /api/v1/conversations`, `GET /api/v1/conversations/:id/messages`, WebSocket for live bidirectional chat, presigned S3 upload for media.

### 3.6 Saved Workers (`page === 'Saved workers'`)
- Displays workers filtered by `liked.includes(w.id)`.
- If empty, renders `<EmptyState>` with a button navigating to Explore Services.
- Backend Requirement: `GET /api/v1/customers/saved-workers`, `POST/DELETE /api/v1/customers/saved-workers/:id`.

### 3.7 Customer Profile & Settings (`page === 'Profile & settings'`)
- Profile card: Hardcoded avatar (`GS`), Name ("Gurubachan Singh"), Tag "Demo profile", "Edit profile" button (triggers toast).
- Settings rows: "Personal information", "Saved addresses", "Notifications", "Privacy & safety".
- All rows trigger placeholder toasts.
- Gaps: No address management modal/list; no form to change name, email, or phone.
- Backend Requirement: Real profile management endpoints and address CRUD.

---

## 4. Worker-Facing Screens Audit

### 4.1 Worker Dashboard (`page === 'Dashboard'`)
- **Welcome Row:** Availability toggle button.
  - Toggles `availability` boolean state; switches between *"You're online"* (green dot) and *"You're offline"*.
  - Backend Requirement: `PATCH /api/v1/workers/availability` updating database and socket presence.
- **Worker Stat Grid:**
  - "Today's earnings": `₹1,840` (Hardcoded string).
  - "Jobs completed": `8` (Hardcoded).
  - "Your rating": `4.8` from 96 reviews (Hardcoded).
  - "Response time": `12 min` (Hardcoded).
- **Job Requests Panel:**
  - Displays first 2 requests from `jobs` state array (`SQ-1048`, `SQ-1047`).
  - Has "Accept" and "Counter" buttons.
- **Earnings Overview Panel:**
  - Displays "Earned this week" (`₹8,640`), 7-day CSS bar chart with active Friday bar, and link to Earnings page.
- **Quick Tools Grid:** 4 shortcuts navigating to Active jobs, Earnings, Reviews, Profile.

### 4.2 Job Requests (`page === 'Job requests'`)
- Shows list of available job request cards from `jobs` state.
- Card details: Title, Category icon, Status tag (`New request`), Job ID (`SQ-1048`), Customer name, Location, Customer budget, Flexible timing badge.
- **Actions:**
  - **"Accept job":** Calls `acceptJob(job)`, removes job from `jobs`, appends to `activeJobs` with status `'Accepted'`, triggers toast.
  - **"Make a counter-offer":** Opens `<Modal>` (`modal === 'counter'`).

### 4.3 Counter-Offer Modal (`modal === 'counter'`)
- Displays target job title, customer name, location, and listed budget.
- Counter Price Stepper: `Minus` (-₹50), `Plus` (+₹50), bounded to min ₹100.
- Quick price pills: `[₹300, ₹350, ₹400, ₹450]`.
- Action: "Send counter-offer" executes `submitCounter()`, updating `offers` dictionary in state `{ [jobId]: counterPrice }`, closes modal, shows toast.
- Backend Requirement: `POST /api/v1/bookings/:id/offers` with counter validation.

### 4.4 Active Jobs (`page === 'Active jobs'`)
- Renders jobs moved from requests into `activeJobs` state array.
- Card has green tag `Accepted`, buttons are disabled (`Accepted`, *"Counter-offers close once a job is accepted."*).
- Gaps:
  - No transition buttons to advance the job (`Start Journey`, `Mark Arrived`, `Start Work`, `Complete Work`).
  - No customer contact button or in-app chat launch.
  - No OTP entry for work verification.
  - Backend Requirement: Full job lifecycle transition controls.

### 4.5 Worker Earnings (`page === 'Earnings'`)
- Stat Cards: "This week" (`₹8,640`), "This month" (`₹24,350`), "Paid jobs" (`31`).
- Recent Earnings Table: 4 static rows (Kitchen tap repair ₹450, Fan installation ₹600, Bathroom cleaning ₹850, Pipe inspection ₹350).
- Gaps: No net vs gross calculation, no platform commission breakdown, no bank account settlement status.
- Backend Requirement: `GET /api/v1/workers/earnings` reading from double-entry ledger.

### 4.6 Ratings & Reviews (`page === 'Ratings & reviews'`)
- Summary card: 4.8 score, star distribution bars (5 stars: 82%, 4 stars: 13%, etc.).
- Review list: 3 static cards (`Priya Shah`, `Rahul Mehta`, `Neha Joshi`).
- Gaps: No worker response/reply functionality; static numbers.
- Backend Requirement: `GET /api/v1/workers/reviews`.

---

## 5. Frontend-to-Backend Integration Map

| Frontend Action / Event | Trigger Location | Current Simulated Behavior | Required Target API Endpoint | HTTP Method | Target DB Entity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User Sign In / Registration** | Topbar / Auth Modal | None (Role switch only) | `/api/v1/auth/verify-otp` | POST | `users`, `customer_profiles`, `worker_profiles` |
| **Fetch Location & Address** | Topbar Location | Static text `"Bhayandar"` | `/api/v1/customers/addresses` | GET | `addresses` |
| **Browse Categories** | Home & Explore | Local `categories` constant | `/api/v1/services/categories` | GET | `service_categories` |
| **Search Professionals** | Search Input / Category Click | In-memory `workers.filter()` | `/api/v1/workers/search` | GET | `worker_profiles`, `services`, PostGIS distance |
| **Save / Unsave Worker** | Heart button on card | In-memory array toggle | `/api/v1/customers/saved-workers/:id` | POST/DELETE | `saved_workers` |
| **Submit Booking Request** | Booking Modal Submit | In-memory `setBookings()` | `/api/v1/bookings` | POST | `bookings`, `booking_status_history` |
| **Fetch Customer Bookings** | My Bookings page | Static + in-memory array | `/api/v1/bookings` | GET | `bookings` |
| **Worker Toggle Availability**| Dashboard Top Toggle | In-memory `setAvailability()`| `/api/v1/workers/availability` | PATCH | `worker_profiles.is_online` |
| **Fetch Worker Requests** | Worker Requests page | Static `initialJobs` array | `/api/v1/workers/job-requests` | GET | `bookings`, `job_broadcasts` |
| **Worker Accepts Job** | Accept Button on Job Card | In-memory `setActiveJobs()` | `/api/v1/bookings/:id/accept` | POST | `bookings`, `booking_status_history` |
| **Worker Submits Counter** | Counter Modal Submit | In-memory `setOffers()` | `/api/v1/bookings/:id/offers` | POST | `job_offers`, `booking_status_history` |
| **Send Chat Message** | Message Compose Form | In-memory `setSent()` array | `/api/v1/conversations/:id/messages`| POST + WS | `messages` |
| **Worker Update Job Status** | Active Jobs screen | None | `/api/v1/bookings/:id/status` | PATCH | `bookings`, `booking_status_history` |
| **Fetch Worker Earnings** | Earnings page | Static text & mockup rows | `/api/v1/workers/earnings` | GET | `worker_earnings_ledger`, `settlements` |
| **Fetch Worker Reviews** | Reviews page | Static text & mockup cards | `/api/v1/workers/reviews` | GET | `reviews` |

---

## 6. Critical Missing Screens & Workflows

1. **Authentication & Authorization UI:**
   - Phone OTP input modal/screen.
   - Profile completion onboarding for customers and workers.
   - Login / Register tabs with form validation.
2. **Worker Onboarding & KYC Verification Screen:**
   - Document upload interface (Government ID, trade certificates, address verification).
   - Bank account details entry for automated payouts (Account number, IFSC code).
3. **Comprehensive Booking Detail & Progress Tracking Screen:**
   - Visual progress stepper: Requested -> Worker Confirmed -> On the Way -> Arrived -> Work Started -> Completed.
   - Direct Call / Message shortcut to assigned worker.
   - Cancel Booking trigger with reason selection.
4. **Customer Counter-Offer Review & Acceptance Modal:**
   - When a worker counters, the customer currently has no UI view to review the counter, accept it, decline it, or re-counter.
5. **Payment Checkout & Receipt Screen:**
   - Payment method selection (UPI, Credit/Debit Cards, NetBanking, Cash on Completion).
   - Breakdown of Agreed Price, Taxes, Platform Fee, and Total Paid.
6. **Customer Review Submission Modal:**
   - Star rating picker, quality tags, written review, optional photo upload.
7. **Address Management CRUD Modal:**
   - Add new address with pin-on-map picker, unit number, landmark, and "Set as Default" toggle.
8. **Dispute & Support Resolution Modal:**
   - File dispute against incomplete work, damage, or worker no-show.
