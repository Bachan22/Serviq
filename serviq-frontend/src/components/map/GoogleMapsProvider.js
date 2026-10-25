import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MapProvider } from './MapProvider.js';

export class GoogleMapsProvider extends MapProvider {
  constructor() {
    super();
    this.map = null;
    this.userMarker = null;
    this.radiusCircle = null;
    this.workerMarkers = new Map();
    this.workerLocations = new Map();
    this.activeHighlightId = null;
    this.markerClickCallback = null;
    this.mapClickCallback = null;
    this.boundsChangeCallback = null;
    this.debounceTimer = null;
    this.userLat = null;
    this.userLng = null;
    this.currentRadiusKm = 5;
    this.isAnonymous = false;
    this.googleMaps = null;
    this.advancedMarkerClass = null;
    this.routePolyline = null;
    this.resizeObserver = null;
    this.windowResizeHandler = null;
    this.animationFrames = new Map();
  }

  async init(container, center, zoom = 14) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY');
    }

    const mapId = import.meta.env.VITE_GOOGLE_MAP_ID || 'serviq_map_style_id';

    // Lazy load using official Google Maps functional loader API
    setOptions({
      key: apiKey,
      apiKey,
      version: 'weekly',
    });

    const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ]);

    this.googleMaps = window.google?.maps;
    this.advancedMarkerClass = AdvancedMarkerElement;

    // Soft, light map style with muted POIs & white roads
    const softLightStyles = [
      {
        featureType: 'all',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#747982' }],
      },
      {
        featureType: 'poi',
        elementType: 'all',
        stylers: [{ visibility: 'simplified' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#ffffff' }],
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#d9e8fa' }],
      },
      {
        featureType: 'landscape',
        elementType: 'geometry',
        stylers: [{ color: '#f5f4f0' }],
      },
    ];

    this.map = new Map(container, {
      center: { lat: center.lat, lng: center.lng },
      zoom,
      mapId, // Required for AdvancedMarkerElement
      disableDefaultUI: true,
      clickableIcons: false,
      styles: softLightStyles,
      gestureHandling: 'greedy',
    });

    // ResizeObserver on map container for responsive recalculation
    if (typeof window !== 'undefined' && window.ResizeObserver && container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.recalculateSize();
      });
      this.resizeObserver.observe(container);
    }

    this.windowResizeHandler = () => this.recalculateSize();
    window.addEventListener('resize', this.windowResizeHandler);

    // Map background click
    this.map.addListener('click', (e) => {
      if (this.mapClickCallback) {
        this.mapClickCallback(e);
      }
    });

    // Debounced bounds listener
    this.map.addListener('idle', () => {
      if (!this.map || !this.boundsChangeCallback) return;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      this.debounceTimer = setTimeout(() => {
        if (!this.map) return;
        const bounds = this.map.getBounds();
        const currentZoom = this.map.getZoom();

        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          this.boundsChangeCallback(
            {
              north: ne.lat(),
              south: sw.lat(),
              east: ne.lng(),
              west: sw.lng(),
            },
            currentZoom
          );
        }

        this.updatePillVisibility(currentZoom);
      }, 400);
    });
  }

  recalculateSize() {
    if (this.map && this.googleMaps) {
      this.googleMaps.event.trigger(this.map, 'resize');
    }
  }

  updatePillVisibility(zoom) {
    const isVisible = zoom >= 13;
    const pills = document.querySelectorAll('.serviq-marker-pill');
    pills.forEach((pill) => {
      const parentMarker = pill.closest('.serviq-worker-marker');
      if (parentMarker && parentMarker.classList.contains('highlighted')) {
        pill.style.display = 'block';
      } else {
        pill.style.display = isVisible ? 'block' : 'none';
      }
    });
  }

  setUserLocation(lat, lng) {
    if (!this.map || lat == null || lng == null) return;
    this.userLat = lat;
    this.userLng = lng;

    const userDiv = document.createElement('div');
    userDiv.className = 'serviq-user-marker';
    userDiv.setAttribute('aria-label', 'Your location');
    userDiv.innerHTML = `
      <div class="serviq-user-pulse"></div>
      <div class="serviq-user-dot"></div>
      <div class="serviq-user-label">You</div>
    `;

    if (this.userMarker) {
      this.userMarker.position = { lat, lng };
    } else if (this.advancedMarkerClass) {
      this.userMarker = new this.advancedMarkerClass({
        map: this.map,
        position: { lat, lng },
        content: userDiv,
        zIndex: 1000,
      });
    }

    this.renderRadiusCircle();
  }

  setRadius(radiusKm) {
    this.currentRadiusKm = radiusKm;
    this.renderRadiusCircle();
  }

  renderRadiusCircle() {
    if (!this.map || this.userLat == null || this.userLng == null || !this.googleMaps) return;

    const radiusMeters = this.currentRadiusKm * 1000;

    if (this.radiusCircle) {
      this.radiusCircle.setCenter({ lat: this.userLat, lng: this.userLng });
      this.radiusCircle.setRadius(radiusMeters);
    } else {
      this.radiusCircle = new this.googleMaps.Circle({
        map: this.map,
        center: { lat: this.userLat, lng: this.userLng },
        radius: radiusMeters,
        strokeColor: '#FF9500',
        strokeOpacity: 0.85,
        strokeWeight: 1.5,
        fillColor: '#FF9500',
        fillOpacity: 0.04,
        clickable: false,
      });
    }
  }

  setMarkers(workers = [], isAnonymous = false) {
    if (!this.map || !this.advancedMarkerClass) return;
    this.isAnonymous = isAnonymous;

    // Clear previous markers
    this.workerMarkers.forEach((marker) => {
      marker.map = null;
    });
    this.workerMarkers.clear();

    const currentZoom = this.map.getZoom() || 14;
    const showPill = currentZoom >= 13;

    // Coordinate occurrence tracking to fan out exact/near-overlapping worker locations
    const coordCounts = new Map();

    workers.forEach((w) => {
      if (w.lat == null || w.lng == null) return;

      const initials = (w.firstName ? w.firstName[0] : 'P') + (w.lastInitial ? w.lastInitial[0] : '');
      const displayName = isAnonymous ? 'Service Professional' : `${w.firstName} ${w.lastInitial}`;
      const labelText = `${displayName} · ${w.skill}`;

      // Overlap strategy: apply micro-offset if workers share identical coordinates so every worker remains individually visible & clickable
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

      const markerContainer = document.createElement('div');
      markerContainer.className = 'serviq-worker-marker';
      markerContainer.id = `g-marker-${w.id}`;
      markerContainer.tabIndex = 0;
      markerContainer.setAttribute('role', 'button');
      markerContainer.setAttribute('aria-label', `${displayName}, ${w.skill}, available, ${w.distanceKm} km away`);
      markerContainer.innerHTML = `
        <div class="serviq-marker-avatar">
          ${w.avatarUrl ? `<img src="${w.avatarUrl}" alt="${displayName}" />` : `<span>${initials}</span>`}
          <span class="serviq-marker-online-beacon"></span>
        </div>
        <div class="serviq-marker-pill" style="display: ${showPill ? 'block' : 'none'};">
          ${labelText}
        </div>
      `;

      const marker = new this.advancedMarkerClass({
        map: this.map,
        position: { lat: finalLat, lng: finalLng },
        content: markerContainer,
        title: displayName,
        zIndex: 50,
      });

      marker.addListener('click', () => {
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

    document.querySelectorAll('.serviq-worker-marker.highlighted').forEach((el) => {
      el.classList.remove('highlighted');
    });

    this.workerMarkers.forEach((m) => {
      if (m) m.zIndex = 50;
    });

    if (!workerId) return;

    const el = document.getElementById(`g-marker-${workerId}`);
    if (el) {
      el.classList.add('highlighted');
      const pill = el.querySelector('.serviq-marker-pill');
      if (pill) pill.style.display = 'block';
    }

    const marker = this.workerMarkers.get(workerId);
    if (marker) {
      marker.zIndex = 1000;
    }
  }

  panTo(lat, lng, zoom) {
    if (!this.map || lat == null || lng == null) return;
    this.map.panTo({ lat, lng });
    if (zoom) {
      this.map.setZoom(zoom);
    }
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
    if (this.map) this.map.setZoom((this.map.getZoom() || 14) + 1);
  }

  zoomOut() {
    if (this.map) this.map.setZoom((this.map.getZoom() || 14) - 1);
  }

  /**
   * Smoothly interpolate worker location changes without recreating the map or marker
   */
  updateWorkerLocation(workerId, lat, lng, timestamp) {
    const marker = this.workerMarkers.get(workerId);
    if (!marker || lat == null || lng == null) return;

    // Check for stale coordinates (older than 60s)
    const isStale = timestamp ? Date.now() - timestamp > 60000 : false;
    const el = document.getElementById(`g-marker-${workerId}`);
    if (el) {
      const beacon = el.querySelector('.serviq-marker-online-beacon');
      if (beacon) {
        beacon.style.opacity = isStale ? '0.3' : '1';
        beacon.title = isStale ? 'Location may be stale' : 'Live location active';
      }
    }

    // Cancel any ongoing animation for this worker
    if (this.animationFrames.has(workerId)) {
      cancelAnimationFrame(this.animationFrames.get(workerId));
      this.animationFrames.delete(workerId);
    }

    const currentLoc = this.workerLocations.get(workerId) || marker.position;
    const startLat = typeof currentLoc.lat === 'function' ? currentLoc.lat() : Number(currentLoc.lat);
    const startLng = typeof currentLoc.lng === 'function' ? currentLoc.lng() : Number(currentLoc.lng);
    const targetLat = Number(lat);
    const targetLng = Number(lng);

    // If change is negligible, skip animation
    if (Math.abs(startLat - targetLat) < 0.00001 && Math.abs(startLng - targetLng) < 0.00001) {
      marker.position = { lat: targetLat, lng: targetLng };
      this.workerLocations.set(workerId, { lat: targetLat, lng: targetLng });
      return;
    }

    const startTime = performance.now();
    const duration = 800; // ms smooth glide

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const curLat = startLat + (targetLat - startLat) * ease;
      const curLng = startLng + (targetLng - startLng) * ease;

      marker.position = { lat: curLat, lng: curLng };

      if (progress < 1) {
        const frameId = requestAnimationFrame(animate);
        this.animationFrames.set(workerId, frameId);
      } else {
        this.animationFrames.delete(workerId);
        this.workerLocations.set(workerId, { lat: targetLat, lng: targetLng });
      }
    };

    const frameId = requestAnimationFrame(animate);
    this.animationFrames.set(workerId, frameId);
  }

  /**
   * Render route and ETA between customer and assigned worker
   */
  async showRoute(origin, destination, options = {}) {
    if (!this.map || !origin || !destination) return null;

    this.clearRoute();

    const originLat = Number(origin.lat);
    const originLng = Number(origin.lng);
    const destLat = Number(destination.lat);
    const destLng = Number(destination.lng);

    // Calculate approximate direct distance in km
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLng = ((destLng - originLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((originLat * Math.PI) / 180) *
        Math.cos((destLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directKm = (6371 * c).toFixed(1);
    const approxDurationMins = Math.max(5, Math.round(Number(directKm) * 3));

    let routeDetails = {
      distanceKm: directKm,
      durationText: `~${approxDurationMins} min`,
    };

    // Attempt DirectionsService if available
    if (this.googleMaps?.DirectionsService) {
      try {
        const ds = new this.googleMaps.DirectionsService();
        const response = await new Promise((resolve, reject) => {
          ds.route(
            {
              origin: { lat: originLat, lng: originLng },
              destination: { lat: destLat, lng: destLng },
              travelMode: this.googleMaps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === 'OK' && result?.routes?.[0]) resolve(result);
              else reject(new Error(status));
            }
          );
        });

        const leg = response.routes[0].legs[0];
        routeDetails = {
          distanceKm: (leg.distance.value / 1000).toFixed(1),
          durationText: leg.duration.text,
        };

        this.routePolyline = new this.googleMaps.Polyline({
          path: response.routes[0].overview_path,
          geodesic: true,
          strokeColor: '#FF9500',
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: this.map,
        });
      } catch (err) {
        // Fallback to straight-line styled geodesic path
        this.routePolyline = new this.googleMaps.Polyline({
          path: [
            { lat: originLat, lng: originLng },
            { lat: destLat, lng: destLng },
          ],
          geodesic: true,
          strokeColor: '#FF9500',
          strokeOpacity: 0.8,
          strokeWeight: 3.5,
          map: this.map,
        });
      }
    } else if (this.googleMaps?.Polyline) {
      this.routePolyline = new this.googleMaps.Polyline({
        path: [
          { lat: originLat, lng: originLng },
          { lat: destLat, lng: destLng },
        ],
        geodesic: true,
        strokeColor: '#FF9500',
        strokeOpacity: 0.8,
        strokeWeight: 3.5,
        map: this.map,
      });
    }

    // Fit map bounds to show both customer and worker
    if (this.googleMaps?.LatLngBounds) {
      const bounds = new this.googleMaps.LatLngBounds();
      bounds.extend({ lat: originLat, lng: originLng });
      bounds.extend({ lat: destLat, lng: destLng });
      this.map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }

    return routeDetails;
  }

  clearRoute() {
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
      this.routePolyline = null;
    }
  }

  destroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }
    this.animationFrames.forEach((frameId) => cancelAnimationFrame(frameId));
    this.animationFrames.clear();
    this.clearRoute();

    if (this.workerMarkers) {
      this.workerMarkers.forEach((m) => {
        m.map = null;
      });
      this.workerMarkers.clear();
    }
    if (this.userMarker) {
      this.userMarker.map = null;
      this.userMarker = null;
    }
    if (this.radiusCircle) {
      this.radiusCircle.setMap(null);
      this.radiusCircle = null;
    }
    this.map = null;
  }
}
