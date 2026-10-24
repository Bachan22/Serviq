# Serviq Frontend Preview

A frontend-only React + Vite prototype for a local blue-collar services marketplace. It includes both Customer and Worker experiences with the Minimal Neutral + Amber design direction.

## Run locally

1. Install Node.js (current LTS recommended).
2. Open this folder in Antigravity or a terminal.
3. Run `npm install`
4. Run `npm run dev`
5. Open the local URL printed by Vite.

To verify a production build: `npm run build`.

## What's included

### Customer experience
- Home page and service discovery
- Service categories and professional cards
- Search/filter interactions
- Save/unsave professionals
- Booking request form with date, time, address and job notes
- Local preview booking history
- Messages UI with local-only demo chat
- Profile/settings placeholder screen

### Worker experience
- Dashboard with summary cards and illustrative earnings chart
- Online/offline availability toggle
- Incoming job requests
- Accept job interaction
- Counter-offer modal with price stepper and quick amounts
- Active jobs, earnings, ratings/reviews, messages and profile screens

### UI/UX
- Responsive desktop, tablet and mobile layouts
- Shared reusable UI components
- Hover, focus, modal and toast transitions
- Keyboard focus indicators
- Reduced-motion preference support
- Minimal Neutral + Amber palette

## Important backend handoff notes

This project intentionally does **not** include a server or database. State is stored in React memory and resets on page refresh. All people, reviews, earnings, availability and jobs are sample data. Booking, chat, job acceptance, and counter-offers are local UI simulations only. They do not contact a real person, charge money, or persist to a database.

When adding the backend, preserve the component interfaces and replace the local handlers/sample arrays with API calls. Suggested integration points:
- Authentication and role: topbar role switch (currently a demo-only preview switch)
- Services/workers: `categories`, `workers`
- Customer bookings: `bookings`, `confirmBooking`
- Worker requests and active jobs: `jobs`, `activeJobs`, `acceptJob`
- Negotiation: `offers`, `sendCounter`, `submitCounter`
- Messages: `MessagesPage`
- Earnings and ratings: `EarningsPage`, `ReviewsPage`

## Suggested production architecture

- Keep customer and worker routes separate, while sharing tokens, buttons, cards, modals and form controls.
- Move mock data into a `src/data/` folder during the backend integration step.
- Add API modules under `src/api/` and call them from feature hooks rather than putting fetch logic directly in UI components.
- Add loading, empty, error, retry and permission states for each API-backed feature.
- Enforce role permissions and all pricing, booking, payout, and job state changes on the server. Frontend-only checks are not security.

## Design tokens

- Ink: `#0F1115`
- Amber: `#FF9900`
- Soft grey background: `#F5F5F5`
- White surfaces: `#FFFFFF`
- Muted text: `#6B7280`

This is a frontend prototype and implementation starter, not a production-ready marketplace.
