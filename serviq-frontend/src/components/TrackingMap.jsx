import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Home, Crosshair, MapPin, Compass } from 'lucide-react';

export default function TrackingMap({
  workerLocation,
  destinationLocation,
  workerName = 'Service Professional',
  destinationAddress = 'Service Destination',
  routeCoordinates = [],
  isRoadRoute = true,
  status = 'on_the_way',
  height = '420px',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const workerMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const polylineBgRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center (Mumbai/Bhayandar)
    const initialLat = workerLocation?.lat || destinationLocation?.lat || 19.298;
    const initialLng = workerLocation?.lng || destinationLocation?.lng || 72.855;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false, // We provide modern custom controls
      attributionControl: true,
    });

    // High quality OpenStreetMap tiles with permitted attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Observe container resize to avoid grey/blank tiles
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Worker Marker
    if (workerLocation?.lat != null && workerLocation?.lng != null) {
      const isMoving = status === 'on_the_way';
      const workerIcon = L.divIcon({
        className: 'serviq-map-worker-icon-wrapper',
        html: `
          <div class="serviq-worker-pin ${isMoving ? 'is-moving' : ''}">
            <div class="pulse-ring"></div>
            <div class="pin-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
            </div>
            <div class="pin-label">${workerName.split(' ')[0]}</div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      if (!workerMarkerRef.current) {
        workerMarkerRef.current = L.marker([workerLocation.lat, workerLocation.lng], { icon: workerIcon })
          .addTo(map)
          .bindPopup(`<b>${workerName}</b><br><small>Service Specialist · Live Location</small>`);
      } else {
        workerMarkerRef.current.setLatLng([workerLocation.lat, workerLocation.lng]);
        workerMarkerRef.current.setIcon(workerIcon);
      }
    }

    // 2. Destination Marker
    if (destinationLocation?.lat != null && destinationLocation?.lng != null) {
      const destIcon = L.divIcon({
        className: 'serviq-map-dest-icon-wrapper',
        html: `
          <div class="serviq-dest-pin">
            <div class="dest-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([destinationLocation.lat, destinationLocation.lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>Service Location</b><br><small>${destinationAddress}</small>`);
      } else {
        destMarkerRef.current.setLatLng([destinationLocation.lat, destinationLocation.lng]);
      }
    }

    // 3. Route Polyline
    if (routeCoordinates && routeCoordinates.length > 1) {
      // Background shadow line
      if (!polylineBgRef.current) {
        polylineBgRef.current = L.polyline(routeCoordinates, {
          color: '#0F1115',
          weight: 6,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        polylineBgRef.current.setLatLngs(routeCoordinates);
      }

      // Foreground active route line (solid amber for real road, dashed if straight-line fallback)
      if (!polylineRef.current) {
        polylineRef.current = L.polyline(routeCoordinates, {
          color: isRoadRoute ? '#FF9900' : '#6B7280',
          weight: 4,
          opacity: 0.95,
          dashArray: isRoadRoute ? null : '6, 8',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(routeCoordinates);
        polylineRef.current.setStyle({
          color: isRoadRoute ? '#FF9900' : '#6B7280',
          dashArray: isRoadRoute ? null : '6, 8',
        });
      }
    } else if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
      if (polylineBgRef.current) {
        map.removeLayer(polylineBgRef.current);
        polylineBgRef.current = null;
      }
    }
  }, [workerLocation, destinationLocation, routeCoordinates, isRoadRoute, status, workerName, destinationAddress]);

  // Recenter map bounds to fit both points
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const points = [];
    if (workerLocation?.lat != null && workerLocation?.lng != null) {
      points.push([workerLocation.lat, workerLocation.lng]);
    }
    if (destinationLocation?.lat != null && destinationLocation?.lng != null) {
      points.push([destinationLocation.lat, destinationLocation.lng]);
    }

    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    } else if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 16,
        animate: true,
      });
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className="serviq-tracking-map-container" style={{ position: 'relative', height, width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {/* Modern Floating Map Controls */}
      <div className="map-floating-controls" style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <button
          type="button"
          onClick={handleRecenter}
          className="map-ctrl-btn"
          title="Recenter Map"
          aria-label="Recenter map"
        >
          <Crosshair size={18} />
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="map-ctrl-btn"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="map-ctrl-btn"
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Floating Live Badge */}
      <div className="map-floating-status" style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 1000,
        background: 'rgba(15, 17, 21, 0.88)',
        backdropFilter: 'blur(8px)',
        color: '#FFFFFF',
        padding: '6px 12px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        <span className="live-dot-beacon" style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: status === 'on_the_way' ? '#10B981' : status === 'arrived' ? '#3B82F6' : '#FF9900',
          display: 'inline-block',
          boxShadow: `0 0 0 2px rgba(255,255,255,0.2)`,
        }} />
        <span>
          {status === 'on_the_way'
            ? 'LIVE EN ROUTE'
            : status === 'arrived'
            ? 'ARRIVED AT DESTINATION'
            : status === 'in_progress'
            ? 'SERVICE IN PROGRESS'
            : 'DISPATCHED'}
        </span>
      </div>
    </div>
  );
}
