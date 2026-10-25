import { LeafletProvider } from './LeafletProvider.js';
import { GoogleMapsProvider } from './GoogleMapsProvider.js';

/**
 * Map Provider Factory
 * Returns a GoogleMapsProvider if VITE_GOOGLE_MAPS_API_KEY is configured,
 * otherwise automatically returns the Leaflet fallback provider.
 */
export function createMapProvider() {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (googleApiKey && typeof googleApiKey === 'string' && googleApiKey.trim().length > 0) {
    try {
      return new GoogleMapsProvider();
    } catch (err) {
      console.warn('[MapProvider] Failed to instantiate GoogleMapsProvider, falling back to Leaflet:', err);
      return new LeafletProvider();
    }
  }

  // Fallback Leaflet provider
  return new LeafletProvider();
}
