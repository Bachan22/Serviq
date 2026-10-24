/**
 * Serviq Routing Utility
 * Fetches real driving routes from the OpenStreetMap / OSRM public routing API.
 * Provides resilient fallbacks with Haversine distance when routing is unavailable.
 */

import { calculateDistanceKm } from '../api/database.js';

export async function getDrivingRoute(originLat, originLng, destLat, destLng) {
  if (originLat == null || originLng == null || destLat == null || destLng == null) {
    return null;
  }

  // Prevent routing identical coordinates
  if (Math.abs(originLat - destLat) < 0.0001 && Math.abs(originLng - destLng) < 0.0001) {
    return {
      coordinates: [[originLat, originLng]],
      distanceKm: 0,
      durationMinutes: 0,
      isRoadRoute: true,
      summary: 'At destination',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // GeoJSON coordinates are [lng, lat], Leaflet polyline expects [lat, lng]
        const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const distKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMins = Math.max(1, Math.round(route.duration / 60));

        return {
          coordinates: latLngs,
          distanceKm: distKm,
          durationMinutes: durationMins,
          isRoadRoute: true,
          summary: `${distKm} km via road · ~${durationMins} min`,
        };
      }
    }
  } catch (err) {
    // Graceful fallback to Haversine straight-line if offline or timeout
    console.warn('[Routing] OSRM routing request failed, falling back to straight-line:', err.message);
  }

  // Fallback: Straight-line calculation
  const straightDist = calculateDistanceKm(originLat, originLng, destLat, destLng);
  // Estimate urban driving time at average 25 km/h in city traffic
  const estMins = straightDist ? Math.max(2, Math.round((straightDist / 25) * 60)) : null;

  return {
    coordinates: [
      [originLat, originLng],
      [destLat, destLng],
    ],
    distanceKm: straightDist,
    durationMinutes: estMins,
    isRoadRoute: false,
    summary: straightDist != null ? `${straightDist} km straight-line (estimated ~${estMins} min)` : 'Distance unavailable',
  };
}
