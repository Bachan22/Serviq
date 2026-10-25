# Serviq — Google Maps Platform Configuration & Cost Control Guide

This guide details the security setup, key restriction best practices, SKU cost control, and credentials isolation for Serviq.

---

## 1. Required Google Maps Platform APIs

Only enable the exact APIs required for Serviq customer and worker discovery:

1. **Maps JavaScript API** (Required)
   - Enables vector/raster client rendering, customized minimal neutral themes, `AdvancedMarkerElement`, clustering, and real-time panning.
2. **Directions API** (Optional / Server-side)
   - Used for calculating driving/transit polylines, ETA, and turn-by-turn routes between the customer and assigned worker.
   - Recommended to be accessed via Fastify backend proxy to prevent client-side credential exposure and quota abuse.
3. **Geocoding API / Places API** (Server-side)
   - Address search, reverse geocoding to neighbourhood names. Handled on backend routes.

---

## 2. API Key Separation Architecture

Never use a single unrestricted API key for both browser and server operations.

| Key Identifier | Location | Restriction Type | Permitted APIs |
| :--- | :--- | :--- | :--- |
| **Browser Key** (`VITE_GOOGLE_MAPS_API_KEY`) | Client bundle (`serviq-frontend/.env`) | **HTTP Referrers** (Websites) | **Maps JavaScript API** strictly |
| **Server Key** (`GOOGLE_MAPS_SERVER_KEY`) | Backend only (`serviq-backend/.env`) | **IP Addresses** (Server IPs) | Directions API, Geocoding API |

> [!CAUTION]
> **Never prefix server keys with `VITE_`!** Any variable prefixed with `VITE_` is automatically bundled into the public client JavaScript payload and can be extracted by any website visitor.

---

## 3. Browser Key Restrictions (Google Cloud Console)

Navigate to **Google Cloud Console → APIs & Services → Credentials** and edit your browser key:

### A. Application Restrictions
Select **Websites (HTTP referrers)** and add the following allowed referrer patterns:

- `http://localhost:5173/*` (Local development)
- `http://localhost:*` (Local alternative dev ports)
- `http://127.0.0.1:5173/*` (Local loopback)
- `https://*.vercel.app/*` (Vercel preview & staging builds)
- `https://serviq.in/*` (Approved production domain)
- `https://www.serviq.in/*` (Approved production domain with www)

### B. API Restrictions
Select **Restrict key** and check ONLY:
- ✅ **Maps JavaScript API**

Do **not** allow Directions API, Distance Matrix API, or Places API on the browser key.

---

## 4. Quotas, Cost Control & Budget Alerts

1. **Billing & SKU Awareness:**
   - Google Maps Platform provides a monthly recurring $200 credit per billing account on eligible SKUs.
   - **Do not assume trial credits cover every SKU without limits.** Dynamic Maps JavaScript API loads count towards the Maps SKU ($7.00 per 1,000 loads beyond free tier).
2. **Daily Quotas:**
   - Under **Google Maps Platform → Quotas**, set daily maximum caps (e.g., max 1,000 map loads per day in staging/development).
   - Once the threshold is reached, requests return `OVER_QUERY_LIMIT` rather than incurring unexpected credit card charges.
3. **Budgets & Alerts:**
   - Navigate to **Billing → Budgets & alerts**.
   - Create a budget (e.g., $50/month) with alert notifications at 50%, 80%, 100%, and 120% sent to engineering email/Slack.

---

## 5. Deployment Environment Configuration (Vercel)

When deploying `serviq-frontend` to Vercel:
1. Open Project Settings → **Environment Variables**.
2. Add:
   - `VITE_GOOGLE_MAPS_API_KEY`: `<Your Restricted Browser API Key>`
   - `VITE_GOOGLE_MAP_ID`: `serviq_map_style_id`
3. Ensure Vercel production and preview deployment URLs match the HTTP referrer whitelist in Google Cloud Console.
