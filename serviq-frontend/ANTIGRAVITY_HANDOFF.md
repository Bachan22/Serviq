# Antigravity Handoff — Serviq Frontend

## Objective
Build the frontend first. Do not add a database or production backend in this stage. Keep the existing design and interactions intact when backend work starts.

## Brand and design direction
- Brand working name: Serviq (replace if the team chooses a different final name).
- Style: premium, minimal, calm, practical; influenced by the clarity of major consumer brands, without copying their branding.
- Main palette: Minimal Neutral + Amber.
  - Ink: `#0F1115`
  - Amber: `#FF9900`
  - Soft background: `#F5F5F5`
  - Card surface: `#FFFFFF`
  - Muted text: `#6B7280`
- Avoid large gradients, overuse of amber, dense decorative effects, or low-contrast text.
- Typography: Manrope for headings and DM Sans for body/interface text.
- Interactions: subtle lift on cards, visible keyboard focus, small modal/toast transitions, and reduced-motion support.

## Layout structure
- `src/main.jsx`: React entry point.
- `src/App.jsx`: app shell, navigation, both role experiences, modal state, and local demo interactions.
- `src/styles.css`: design tokens, component styles, responsive breakpoints, motion and reduced-motion behavior.
- `index.html`: page metadata and fonts.
- `README.md`: setup and implementation notes.

## App shell
- Sticky top bar: logo, location, Customer/Worker preview switch, notifications, profile menu.
- Sidebar: role-specific navigation and help panel.
- Main content: responsive feature pages.
- Footer: trust statement and explicit demo-data disclosure.
- Customer/Worker switch is only a preview convenience. Replace it with authenticated role routing; never use a public role switch as real authorization.

## Customer screens and behavior
1. **Home**
   - Welcome headline and local-area indicator.
   - Main hero with a clear value statement.
   - Search field and location summary.
   - Service category cards.
   - Nearby professional cards with rating, distance, starting price, verification marker, save button, and booking CTA.
   - Trust/safety information strip.
2. **Explore services**
   - Search/filter professionals and choose a service category.
   - Empty state if there are no matches.
3. **Booking modal**
   - Selected professional, service category, preferred date/time, address, optional issue description.
   - Frontend validation should be added before backend integration.
   - Current submit creates a local preview booking only.
4. **My bookings**
   - Booking status and sample history table.
5. **Messages**
   - Conversation list, sample chat history, message composer. Local-only simulation.
6. **Saved workers**
   - Save/unsave worker cards.
7. **Profile & settings**
   - Personal details, addresses, notifications and privacy rows (placeholder actions).

## Worker screens and behavior
1. **Dashboard**
   - Availability toggle.
   - Today’s earnings, jobs completed, rating, response-time summary cards.
   - Incoming request previews with accept/counter actions.
   - Illustrative weekly earnings chart.
   - Quick links to active jobs, earnings, reviews, profile.
2. **Job requests**
   - Request cards with service, customer, location, request age, customer budget.
   - Accept job and make counter-offer actions.
3. **Counter-offer modal**
   - Customer’s listed budget, price stepper, quick-price buttons, submit action.
   - Current submit is a local simulation; backend must validate and persist offers.
4. **Active jobs**
   - Jobs accepted in the current browser session.
5. **Earnings**
   - Summary cards and sample transaction rows. All numbers are illustrative.
6. **Ratings & reviews**
   - Rating summary, distribution bars and sample reviews.
7. **Messages and profile/settings**
   - Shared message UI and placeholder settings.

## Current local demo behavior
- Customer/Worker switch changes the visible interface.
- Customer search filters the sample worker list.
- Category cards can be selected.
- Worker cards can be saved/unsaved.
- Booking form creates a local booking record.
- Messages can be appended to local chat state.
- Worker availability can be toggled.
- Accepting a job moves it from sample requests into local active jobs.
- Counter-offer can be adjusted and submitted locally.
- Toasts confirm UI actions and state changes.
- Local state is reset by a page refresh. Nothing is sent to a server.

## Backend integration contract (future stage)
Create API modules and feature hooks rather than embedding fetch logic in visual components. Expected future resources:
- `users`, `customer_profiles`, `worker_profiles`
- `service_categories`, `worker_services`, `service_areas`
- `bookings`, `booking_status_history`
- `job_requests`, `job_offers`, `negotiation_messages`
- `conversations`, `messages`, `notifications`
- `reviews`, `earnings_ledger`, `payouts`

Suggested API boundaries (final routes to be decided during backend design):
- Auth/session: sign-in, sign-out, current user, role permissions.
- Services: list categories, search professionals, worker detail.
- Bookings: create request, list customer bookings, view status, cancel/reschedule.
- Worker jobs: list eligible requests, accept/reject, mark job progress/completion.
- Negotiation: create offer, accept/reject/counter, retrieve offer history.
- Messaging: list conversations, send/read messages, unread count.
- Earnings: summary, ledger, payout state.
- Reviews: list and submit reviews.
- Profile: update details, addresses, service area, availability.

## Required integration states
For each server-backed screen, implement:
- Loading/skeleton state.
- Empty state.
- Error state with retry.
- Success state.
- Disabled/submitting state to prevent duplicate submissions.
- Permission-denied and expired-session handling where relevant.
- Mobile-friendly feedback and accessible labels.

## Non-negotiable safety and correctness notes
- All prices, job eligibility, status transitions, payment/payout logic and user permissions must be validated on the server.
- Do not claim a booking, payment, notification or message is real until the API confirms success.
- Replace all sample earnings, ratings, worker identities and reviews before public launch.
- Never store secrets or API keys in frontend code.
- Add authentication and authorization before exposing customer or worker data.
- Keep customer and worker routes separated after authentication; frontend role checks are not security.

## Setup
```bash
npm install
npm run dev
```
Production build check:
```bash
npm run build
```
