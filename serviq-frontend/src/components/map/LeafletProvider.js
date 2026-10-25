import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapProvider } from './MapProvider.js';

export class LeafletProvider extends MapProvider {
  constructor() {
    super();
    this.map = null;
    this.userMarker = null;
    this.radiusCircle = null;
    this.workerMarkers = new Map();
    this.activeHighlightId = null;
    this.markerClickCallback = null;
    this.mapClickCallback = null;
    this.boundsChangeCallback = null;
    this.currentWorkers = [];
    this.isAnonymous = false;
    this.debounceTimer = null;
    this.userLat = null;
    this.userLng = null;
    this.currentRadiusKm = 5;
  }

  async init(container, center, zoom = 14) {
    if (this.map) {
      this.destroy();
    }

    this.map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
    }).setView([center.lat, center.lng], zoom);

    // Light CartoDB Positron / OSM tiles for a clean, muted, aesthetic appearance
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(this.map);

    this.map.on('click', (e) => {
      // If clicking on map background, close info card
      if (this.mapClickCallback) {
        this.mapClickCallback(e);
      }
    });

    const triggerBounds = () => {
      if (!this.map || !this.boundsChangeCallback) return;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      this.debounceTimer = setTimeout(() => {
        if (!this.map) return;
        const bounds = this.map.getBounds();
        const currentZoom = this.map.getZoom();

        // Update visibility of labels based on zoom >= 14
        this.updatePillVisibility(currentZoom);

        this.boundsChangeCallback(
          {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
          currentZoom
        );
      }, 400);
    };

    this.map.on('moveend', triggerBounds);
    this.map.on('zoomend', triggerBounds);

    // Initial label visibility
    this.updatePillVisibility(zoom);
  }

  updatePillVisibility(zoom) {
    const isVisible = zoom >= 14;
    const pills = document.querySelectorAll('.serviq-marker-pill');
    pills.forEach((pill) => {
      if (isVisible) {
        pill.style.display = 'block';
      } else {
        pill.style.display = 'none';
      }
    });
  }

  setUserLocation(lat, lng) {
    if (!this.map || lat == null || lng == null) return;
    this.userLat = lat;
    this.userLng = lng;

    const userHtml = `
      <div class="serviq-user-marker" aria-label="Your location">
        <div class="serviq-user-pulse"></div>
        <div class="serviq-user-dot"></div>
        <div class="serviq-user-label">You</div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: '',
      html: userHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = L.marker([lat, lng], {
        icon: userIcon,
        zIndexOffset: 1000,
        interactive: false,
      }).addTo(this.map);
    }

    this.renderRadiusCircle();
  }

  setRadius(radiusKm) {
    this.currentRadiusKm = radiusKm;
    this.renderRadiusCircle();
  }

  renderRadiusCircle() {
    if (!this.map || this.userLat == null || this.userLng == null) return;

    const radiusMeters = this.currentRadiusKm * 1000;

    if (this.radiusCircle) {
      this.radiusCircle.setLatLng([this.userLat, this.userLng]);
      this.radiusCircle.setRadius(radiusMeters);
    } else {
      this.radiusCircle = L.circle([this.userLat, this.userLng], {
        radius: radiusMeters,
        color: '#FF9500',
        weight: 1.5,
        dashArray: '6, 8',
        fillColor: '#FF9500',
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(this.map);
    }
  }

  setMarkers(workers = [], isAnonymous = false) {
    if (!this.map) return;
    this.currentWorkers = workers;
    this.isAnonymous = isAnonymous;

    // Remove old markers
    this.workerMarkers.forEach((marker) => marker.remove());
    this.workerMarkers.clear();

    const currentZoom = this.map.getZoom();
    const showPill = currentZoom >= 13;

    // Track coordinates to fan out overlapping locations
    const coordCounts = new Map();

    // Render individual worker markers
    workers.forEach((w) => {
      if (w.lat == null || w.lng == null) return;

      const initials = (w.firstName ? w.firstName[0] : 'P') + (w.lastInitial ? w.lastInitial[0] : '');
      const displayName = isAnonymous
        ? 'Service Professional'
        : `${w.firstName} ${w.lastInitial}`;
      const labelText = `${displayName} · ${w.skill}`;

      const coordKey = `${Number(w.lat).toFixed(4)},${Number(w.lng).toFixed(4)}`;
      const overlapIndex = coordCounts.get(coordKey) || 0;
      coordCounts.set(coordKey, overlapIndex + 1);

      let finalLat = Number(w.lat);
      let finalLng = Number(w.lng);
      if (overlapIndex > 0) {
        const angle = (overlapIndex * 2 * Math.PI) / 6;
        const offsetDist = 0.00025; // ~25 meters
        finalLat += Math.cos(angle) * offsetDist;
        finalLng += Math.sin(angle) * offsetDist;
      }

      const markerHtml = `
        <div class="serviq-worker-marker" id="marker-${w.id}" tabindex="0" role="button" aria-label="${displayName}, ${w.skill}, available, ${w.distanceKm} km away">
          <div class="serviq-marker-avatar">
            ${w.avatarUrl ? `<img src="${w.avatarUrl}" alt="${displayName}" />` : `<span>${initials}</span>`}
            <span class="serviq-marker-online-beacon"></span>
          </div>
          <div class="serviq-marker-pill" style="display: ${showPill ? 'block' : 'none'};">
            ${labelText}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: '',
        html: markerHtml,
        iconSize: [40, 60],
        iconAnchor: [20, 44],
      });

      const marker = L.marker([finalLat, finalLng], {
        icon: customIcon,
        zIndexOffset: 50,
      }).addTo(this.map);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (this.markerClickCallback) {
          this.markerClickCallback(w);
        }
      });

      this.workerMarkers.set(w.id, marker);
    });

    if (this.activeHighlightId) {
      this.highlightMarker(this.activeHighlightId);
    }
  }

  highlightMarker(workerId) {
    this.activeHighlightId = workerId;

    // Remove old highlight
    document.querySelectorAll('.serviq-worker-marker.highlighted').forEach((el) => {
      el.classList.remove('highlighted');
    });

    this.workerMarkers.forEach((m) => {
      if (m && typeof m.setZIndexOffset === 'function') m.setZIndexOffset(50);
    });

    if (!workerId) return;

    const el = document.getElementById(`marker-${workerId}`);
    if (el) {
      el.classList.add('highlighted');
      // Always show pill on highlighted marker regardless of zoom
      const pill = el.querySelector('.serviq-marker-pill');
      if (pill) pill.style.display = 'block';
    }

    const marker = this.workerMarkers.get(workerId);
    if (marker && typeof marker.setZIndexOffset === 'function') {
      marker.setZIndexOffset(1000);
    }
  }

  panTo(lat, lng, zoom) {
    if (!this.map || lat == null || lng == null) return;
    const targetZoom = zoom || Math.max(this.map.getZoom(), 15);
    this.map.flyTo([lat, lng], targetZoom, {
      duration: 0.8,
      easeLinearity: 0.25,
    });
  }

  onMarkerClick(cb) {
    this.markerClickCallback = cb;
  }

  onMapClick(cb) {
    this.mapClickCallback = cb;
  }

  onBoundsChange(cb) {
    this.boundsChangeCallback = cb;
  }

  zoomIn() {
    if (this.map) this.map.zoomIn();
  }

  zoomOut() {
    if (this.map) this.map.zoomOut();
  }

  recalculateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  updateWorkerLocation(workerId, lat, lng, timestamp) {
    const marker = this.workerMarkers.get(workerId);
    if (!marker || lat == null || lng == null) return;
    marker.setLatLng([lat, lng]);
  }

  async showRoute(origin, destination, options = {}) {
    if (!this.map || !origin || !destination) return null;
    this.clearRoute();
    const latlngs = [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ];
    this.routePolyline = L.polyline(latlngs, {
      color: '#FF9500',
      weight: 3.5,
      opacity: 0.85,
    }).addTo(this.map);
    this.map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });

    // Haversine distance
    const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
    const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((origin.lat * Math.PI) / 180) *
        Math.cos((destination.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directKm = (6371 * c).toFixed(1);
    const approxDurationMins = Math.max(5, Math.round(Number(directKm) * 3));

    return {
      distanceKm: directKm,
      durationText: `~${approxDurationMins} min`,
    };
  }

  clearRoute() {
    if (this.routePolyline) {
      this.routePolyline.remove();
      this.routePolyline = null;
    }
  }

  destroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.clearRoute();
    if (this.workerMarkers) {
      this.workerMarkers.forEach((m) => m.remove());
      this.workerMarkers.clear();
    }
    if (this.userMarker) {
      this.userMarker.remove();
      this.userMarker = null;
    }
    if (this.radiusCircle) {
      this.radiusCircle.remove();
      this.radiusCircle = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
