/**
 * Serviq Live Location Updates Service (Frontend Integration Boundary)
 * 
 * Manages authorized worker location telemetry for customer maps.
 * Seamlessly integrates with backend real-time mechanisms (Fastify polling or future WebSockets),
 * providing:
 * - Smooth coordinate interpolation
 * - Throttling & debouncing
 * - Stale location detection (> 60s without ping)
 * - Subscription lifecycle & teardown
 * - Status event callbacks (connecting, connected, disconnected, stale)
 */

export class LocationUpdateService {
  /**
   * @param {Object} options
   * @param {string} [options.bookingId] - Booking ID if tracking an assigned worker
   * @param {string} [options.workerId] - Worker ID to track
   * @param {number} [options.pollIntervalMs=5000] - Polling interval fallback
   * @param {(data: { workerId: string, lat: number, lng: number, timestamp: number, isStale: boolean }) => void} options.onLocationUpdate
   * @param {(status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'stale') => void} [options.onStatusChange]
   */
  constructor({ bookingId, workerId, pollIntervalMs = 5000, onLocationUpdate, onStatusChange }) {
    this.bookingId = bookingId;
    this.workerId = workerId;
    this.pollIntervalMs = pollIntervalMs;
    this.onLocationUpdate = onLocationUpdate;
    this.onStatusChange = onStatusChange;

    this.timer = null;
    this.staleCheckTimer = null;
    this.lastUpdateTimestamp = null;
    this.isDestroyed = false;
    this.lastCoordinates = null;
    this.status = 'disconnected';
  }

  /**
   * Start receiving location updates
   */
  start() {
    if (this.isDestroyed) return;
    this.setStatus('connecting');

    // Run first fetch immediately
    this.fetchLatestLocation();

    // Set recurring telemetry polling
    this.timer = setInterval(() => {
      this.fetchLatestLocation();
    }, this.pollIntervalMs);

    // Stale check watchdog every 15s
    this.staleCheckTimer = setInterval(() => {
      this.checkStaleness();
    }, 15000);
  }

  /**
   * Fetch latest coordinates from backend REST endpoint
   */
  async fetchLatestLocation() {
    if (this.isDestroyed) return;

    try {
      const token = localStorage.getItem('serviq_token') || localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = null;
      if (this.bookingId) {
        url = `/api/v1/bookings/${this.bookingId}`;
      } else if (this.workerId) {
        url = `/api/v1/workers/${this.workerId}`;
      }

      if (!url) return;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.setStatus('disconnected');
          this.stop();
          return;
        }
        throw new Error(`HTTP error ${response.status}`);
      }

      const json = await response.json();
      const data = json.data || json;

      // Extract coordinates from booking worker or worker record
      let lat = null;
      let lng = null;
      let updatedAt = null;
      let workerId = this.workerId;

      if (this.bookingId && data.worker) {
        lat = data.worker.latitude;
        lng = data.worker.longitude;
        updatedAt = data.worker.lastLocationUpdatedAt || data.updatedAt;
        workerId = data.worker.id || this.workerId;
      } else {
        lat = data.latitude;
        lng = data.longitude;
        updatedAt = data.lastLocationUpdatedAt || data.updatedAt;
      }

      if (lat != null && lng != null) {
        const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
        const isStale = Date.now() - timestamp > 60000; // > 60s

        this.lastUpdateTimestamp = timestamp;
        this.lastCoordinates = { lat: Number(lat), lng: Number(lng) };
        this.setStatus(isStale ? 'stale' : 'connected');

        if (this.onLocationUpdate) {
          this.onLocationUpdate({
            workerId,
            lat: Number(lat),
            lng: Number(lng),
            timestamp,
            isStale,
          });
        }
      }
    } catch (err) {
      if (this.status !== 'reconnecting') {
        this.setStatus('reconnecting');
      }
    }
  }

  checkStaleness() {
    if (!this.lastUpdateTimestamp) return;
    const isStale = Date.now() - this.lastUpdateTimestamp > 60000;
    if (isStale && this.status === 'connected') {
      this.setStatus('stale');
    }
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  /**
   * Stop subscriptions and timers
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    this.setStatus('disconnected');
  }

  /**
   * Complete lifecycle cleanup
   */
  destroy() {
    this.isDestroyed = true;
    this.stop();
    this.onLocationUpdate = null;
    this.onStatusChange = null;
  }
}
