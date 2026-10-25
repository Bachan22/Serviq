import { apiClient, ApiError } from './client.js';

export const discoveryApi = {
  /**
   * Search nearby workers via PostGIS
   */
  async searchWorkers(options) {
    const res = await apiClient('/workers/search', {
      params: options,
    });
    return {
      workers: res.data,
      meta: res.meta,
    };
  },

  /**
   * Fetch privacy-safe nearby online workers for Map-First Hero
   */
  async getNearbyWorkers({ lat, lng, radiusKm = 5, serviceSlug = '', bounds = null } = {}) {
    const params = {
      lat,
      lng,
      radius_km: radiusKm,
    };
    if (serviceSlug && serviceSlug !== 'all') {
      params.service_slug = serviceSlug;
    }
    if (bounds) {
      if (bounds.north != null) params.north = bounds.north;
      if (bounds.south != null) params.south = bounds.south;
      if (bounds.east != null) params.east = bounds.east;
      if (bounds.west != null) params.west = bounds.west;
    }

    const res = await apiClient('/workers/nearby', { params });
    return res?.data || [];
  },

  /**
   * Reverse geocode coordinates to an area name
   */
  async reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const addr = data.address || {};
      return (
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.city_district ||
        addr.town ||
        addr.city ||
        data.display_name?.split(',')[0] ||
        null
      );
    } catch {
      return null;
    }
  },
};
