/**
 * Serviq Map Provider Base Interface
 * Defines common contracts for Google Maps and Leaflet map providers.
 */
export class MapProvider {
  /**
   * Initialize map in container
   * @param {HTMLElement} container
   * @param {{ lat: number, lng: number }} center
   * @param {number} zoom
   */
  async init(container, center, zoom = 14) {
    throw new Error('init() not implemented');
  }

  /**
   * Set customer's user location
   * @param {number} lat
   * @param {number} lng
   */
  setUserLocation(lat, lng) {
    throw new Error('setUserLocation() not implemented');
  }

  /**
   * Set search radius circle in kilometers
   * @param {number} radiusKm
   */
  setRadius(radiusKm) {
    throw new Error('setRadius() not implemented');
  }

  /**
   * Set and render worker markers on the map
   * @param {Array<Object>} workers
   * @param {boolean} isAnonymous
   */
  setMarkers(workers, isAnonymous = false) {
    throw new Error('setMarkers() not implemented');
  }

  /**
   * Highlight a specific marker (from hover or selection)
   * @param {string|null} workerId
   */
  highlightMarker(workerId) {
    throw new Error('highlightMarker() not implemented');
  }

  /**
   * Smooth pan and zoom to coordinates
   * @param {number} lat
   * @param {number} lng
   * @param {number} [zoom]
   */
  panTo(lat, lng, zoom) {
    throw new Error('panTo() not implemented');
  }

  /**
   * Register marker click callback
   * @param {(worker: Object, anchorRect?: DOMRect) => void} cb
   */
  onMarkerClick(cb) {
    throw new Error('onMarkerClick() not implemented');
  }

  /**
   * Register map background click callback
   * @param {() => void} cb
   */
  onMapClick(cb) {
    throw new Error('onMapClick() not implemented');
  }

  /**
   * Register viewport / bounds change callback (debounced)
   * @param {(bounds: { north: number, south: number, east: number, west: number }, zoom: number) => void} cb
   */
  onBoundsChange(cb) {
    throw new Error('onBoundsChange() not implemented');
  }

  /**
   * Zoom in by 1 level
   */
  zoomIn() {
    throw new Error('zoomIn() not implemented');
  }

  /**
   * Zoom out by 1 level
   */
  zoomOut() {
    throw new Error('zoomOut() not implemented');
  }

  /**
   * Force map to recalculate its dimensions after layout changes
   */
  recalculateSize() {
    // Default no-op
  }

  /**
   * Update a worker's location smoothly without recreating map
   * @param {string} workerId
   * @param {number} lat
   * @param {number} lng
   * @param {number} [timestamp]
   */
  updateWorkerLocation(workerId, lat, lng, timestamp) {
    // Default no-op
  }

  /**
   * Render route and ETA between customer and assigned worker
   * @param {{ lat: number, lng: number }} origin
   * @param {{ lat: number, lng: number }} destination
   * @param {Object} [options]
   */
  async showRoute(origin, destination, options = {}) {
    // Default no-op
  }

  /**
   * Remove any active route polyline from the map
   */
  clearRoute() {
    // Default no-op
  }

  /**
   * Clean up and destroy all map instances, listeners, and timers
   */
  destroy() {
    throw new Error('destroy() not implemented');
  }
}
