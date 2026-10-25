import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Crosshair, MapPin, Navigation, Home, AlertCircle, RefreshCw } from 'lucide-react';

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
  const routePolylineRef = useRef(null);
  const routeBorderPolylineRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const infoWindowRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // SVG Data URIs for crisp, familiar Google Maps navigation markers
  const getWorkerIcon = () => {
    const isMoving = status === 'on_the_way';
    const svg = `
      <svg width="48" height="56" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="shadow" x="0" y="0" width="48" height="56" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
        </filter>
        <g filter="url(#shadow)">
          <path d="M24 2C13.5066 2 5 10.5066 5 21C5 33.25 21.6 47.1 22.31 47.69C22.8 48.1 23.39 48.31 24 48.31C24.61 48.31 25.2 48.1 25.69 47.69C26.4 47.1 43 33.25 43 21C43 10.5066 34.4934 2 24 2Z" fill="#2563EB" stroke="#FFFFFF" stroke-width="2.5"/>
          <circle cx="24" cy="21" r="13" fill="#FFFFFF"/>
          <path d="M19 25C19 22.2386 21.2386 20 24 20C26.7614 20 29 22.2386 29 25V26H19V25Z" fill="#1D4ED8"/>
          <circle cx="24" cy="16" r="3.5" fill="#1D4ED8"/>
        </g>
      </svg>
    `;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim());
  };

  const getHomeIcon = () => {
    const svg = `
      <svg width="44" height="52" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="homeShadow" x="0" y="0" width="44" height="52" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
        </filter>
        <g filter="url(#homeShadow)">
          <path d="M22 2C12.0589 2 4 10.0589 4 20C4 31.6667 19.72 44.86 20.39 45.42C20.86 45.81 21.43 46 22 46C22.57 46 23.14 45.81 23.61 45.42C24.28 44.86 40 31.6667 40 20C40 10.0589 31.9411 2 22 2Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="2.5"/>
          <circle cx="22" cy="19" r="11" fill="#FFFFFF"/>
          <path d="M16 20L22 15L28 20V25H16V20Z" fill="#0F172A"/>
          <rect x="20.5" y="21.5" width="3" height="3.5" fill="#FFFFFF"/>
        </g>
      </svg>
    `;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim());
  };

  // Initialize Google Maps instance
  useEffect(() => {
    let isCancelled = false;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setLoadError('Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY.');
      return;
    }

    const initGoogleMap = async () => {
      try {
        setOptions({
          key: apiKey,
          apiKey,
          version: 'weekly',
        });

        await Promise.all([importLibrary('maps'), importLibrary('routes')]);

        if (isCancelled || !mapContainerRef.current) return;

        const google = window.google;
        const initialLat = workerLocation?.lat || destinationLocation?.lat || 19.298;
        const initialLng = workerLocation?.lng || destinationLocation?.lng || 72.855;

        // Clean, familiar Google Maps navigation styling
        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: initialLat, lng: initialLng },
          zoom: 14,
          disableDefaultUI: true, // Custom controls provided
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ lightness: 100 }, { visibility: 'simplified' }] },
            { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FCD34D' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C7D2FE' }] },
          ],
        });

        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true, // We render our custom high-visibility markers
          preserveViewport: true,
          polylineOptions: {
            strokeColor: '#2563EB',
            strokeWeight: 5,
            strokeOpacity: 0.95,
          },
        });

        infoWindowRef.current = new google.maps.InfoWindow();
        mapInstanceRef.current = map;
        setMapLoaded(true);
        setLoadError(null);
      } catch (err) {
        if (!isCancelled) {
          console.error('[Google Maps] Initialization failed:', err);
          setLoadError(err.message || 'Failed to initialize Google Maps.');
        }
      }
    };

    initGoogleMap();

    return () => {
      isCancelled = true;
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      if (routeBorderPolylineRef.current) routeBorderPolylineRef.current.setMap(null);
      if (workerMarkerRef.current) workerMarkerRef.current.setMap(null);
      if (destMarkerRef.current) destMarkerRef.current.setMap(null);
      mapInstanceRef.current = null;
    };
  }, []);

  // Responsive container observer to trigger Google Maps resize
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current && window.google?.maps) {
        window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [mapLoaded]);

  // Update Markers, Route, and Bounds when locations change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!map || !google?.maps || !mapLoaded) return;

    // 1. Worker Marker
    if (workerLocation?.lat != null && workerLocation?.lng != null) {
      const workerPos = new google.maps.LatLng(workerLocation.lat, workerLocation.lng);
      if (!workerMarkerRef.current) {
        workerMarkerRef.current = new google.maps.Marker({
          position: workerPos,
          map,
          title: `${workerName} (Service Specialist)`,
          icon: {
            url: getWorkerIcon(),
            scaledSize: new google.maps.Size(48, 56),
            anchor: new google.maps.Point(24, 48),
          },
          zIndex: 999,
        });

        workerMarkerRef.current.addListener('click', () => {
          infoWindowRef.current.setContent(`
            <div style="padding: 6px 8px; font-family: inherit;">
              <strong style="color: #0F172A; font-size: 13px;">${workerName}</strong>
              <div style="color: #64748B; font-size: 11px; margin-top: 2px;">Service Professional · Live GPS Position</div>
            </div>
          `);
          infoWindowRef.current.open(map, workerMarkerRef.current);
        });
      } else {
        // Smoothly update worker marker position without recreating map or markers
        workerMarkerRef.current.setPosition(workerPos);
        workerMarkerRef.current.setIcon({
          url: getWorkerIcon(),
          scaledSize: new google.maps.Size(48, 56),
          anchor: new google.maps.Point(24, 48),
        });
      }
    }

    // 2. Customer Home/Pickup Marker
    if (destinationLocation?.lat != null && destinationLocation?.lng != null) {
      const destPos = new google.maps.LatLng(destinationLocation.lat, destinationLocation.lng);
      if (!destMarkerRef.current) {
        destMarkerRef.current = new google.maps.Marker({
          position: destPos,
          map,
          title: `Service Destination: ${destinationAddress}`,
          icon: {
            url: getHomeIcon(),
            scaledSize: new google.maps.Size(44, 52),
            anchor: new google.maps.Point(22, 46),
          },
          zIndex: 998,
        });

        destMarkerRef.current.addListener('click', () => {
          infoWindowRef.current.setContent(`
            <div style="padding: 6px 8px; font-family: inherit;">
              <strong style="color: #0F172A; font-size: 13px;">Service Destination</strong>
              <div style="color: #64748B; font-size: 11px; margin-top: 2px;">${destinationAddress}</div>
            </div>
          `);
          infoWindowRef.current.open(map, destMarkerRef.current);
        });
      } else {
        destMarkerRef.current.setPosition(destPos);
      }
    }

    // 3. Google Maps Blue Navigation Route Display
    const hasWorker = workerLocation?.lat != null && workerLocation?.lng != null;
    const hasDest = destinationLocation?.lat != null && destinationLocation?.lng != null;

    if (hasWorker && hasDest) {
      // Try Google Directions Service first for native road routing
      if (directionsServiceRef.current) {
        directionsServiceRef.current.route(
          {
            origin: { lat: workerLocation.lat, lng: workerLocation.lng },
            destination: { lat: destinationLocation.lat, lng: destinationLocation.lng },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, dirStatus) => {
            if (dirStatus === google.maps.DirectionsStatus.OK && result) {
              if (directionsRendererRef.current) {
                directionsRendererRef.current.setDirections(result);
              }
              // Hide polyline fallback if directions rendered successfully
              if (routePolylineRef.current) routePolylineRef.current.setMap(null);
              if (routeBorderPolylineRef.current) routeBorderPolylineRef.current.setMap(null);
              return;
            }

            // Fallback: Use provided route coordinates (OSRM road coordinates or polyline)
            drawPolylineRoute();
          }
        );
      } else {
        drawPolylineRoute();
      }
    } else {
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      if (routeBorderPolylineRef.current) routeBorderPolylineRef.current.setMap(null);
    }

    function drawPolylineRoute() {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.set('directions', null);
      }

      let points = [];
      if (routeCoordinates && routeCoordinates.length > 1) {
        points = routeCoordinates.map((pt) => {
          if (Array.isArray(pt)) return new google.maps.LatLng(pt[0], pt[1]);
          return new google.maps.LatLng(pt.lat, pt.lng);
        });
      } else if (hasWorker && hasDest) {
        points = [
          new google.maps.LatLng(workerLocation.lat, workerLocation.lng),
          new google.maps.LatLng(destinationLocation.lat, destinationLocation.lng),
        ];
      }

      if (points.length > 1) {
        // Casing / shadow border line
        if (!routeBorderPolylineRef.current) {
          routeBorderPolylineRef.current = new google.maps.Polyline({
            path: points,
            geodesic: true,
            strokeColor: '#1E3A8A',
            strokeOpacity: 0.35,
            strokeWeight: 8,
            map,
            zIndex: 10,
          });
        } else {
          routeBorderPolylineRef.current.setPath(points);
          routeBorderPolylineRef.current.setMap(map);
        }

        // Active blue navigation line
        if (!routePolylineRef.current) {
          routePolylineRef.current = new google.maps.Polyline({
            path: points,
            geodesic: true,
            strokeColor: '#2563EB',
            strokeOpacity: 0.95,
            strokeWeight: 5,
            map,
            zIndex: 11,
          });
        } else {
          routePolylineRef.current.setPath(points);
          routePolylineRef.current.setMap(map);
        }
      }
    }
  }, [mapLoaded, workerLocation, destinationLocation, routeCoordinates, isRoadRoute, status, workerName, destinationAddress]);

  // Recenter map bounds to include both worker and customer destination
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!map || !google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    let count = 0;

    if (workerLocation?.lat != null && workerLocation?.lng != null) {
      bounds.extend(new google.maps.LatLng(workerLocation.lat, workerLocation.lng));
      count++;
    }
    if (destinationLocation?.lat != null && destinationLocation?.lng != null) {
      bounds.extend(new google.maps.LatLng(destinationLocation.lat, destinationLocation.lng));
      count++;
    }

    if (count === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(15);
    } else if (count >= 2) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  };

  const handleZoomIn = () => {
    const map = mapInstanceRef.current;
    if (map) map.setZoom(map.getZoom() + 1);
  };

  const handleZoomOut = () => {
    const map = mapInstanceRef.current;
    if (map) map.setZoom(map.getZoom() - 1);
  };

  return (
    <div
      className="serviq-tracking-map-container"
      style={{
        position: 'relative',
        height,
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
      }}
    >
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {/* Error state */}
      {loadError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          <AlertCircle size={32} color="#EF4444" style={{ marginBottom: '12px' }} />
          <strong style={{ color: '#0F172A', fontSize: '15px' }}>Map Configuration Notice</strong>
          <p style={{ color: '#64748B', fontSize: '13px', maxWidth: '380px', margin: '6px 0 16px' }}>
            {loadError}
          </p>
        </div>
      )}

      {/* Floating Map Navigation Controls */}
      {mapLoaded && (
        <div
          className="map-floating-controls"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={handleRecenter}
            className="map-ctrl-btn"
            title="Recenter Route View"
            aria-label="Recenter map"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1E293B',
            }}
          >
            <Crosshair size={18} />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="map-ctrl-btn"
            title="Zoom in"
            aria-label="Zoom in"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              color: '#1E293B',
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="map-ctrl-btn"
            title="Zoom out"
            aria-label="Zoom out"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              color: '#1E293B',
            }}
          >
            −
          </button>
        </div>
      )}

      {/* Floating Live Navigation Status Badge */}
      <div
        className="map-floating-status"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(8px)',
          color: '#FFFFFF',
          padding: '6px 14px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          letterSpacing: '0.02em',
        }}
      >
        <span
          className="live-dot-beacon"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: status === 'on_the_way' ? '#10B981' : status === 'arrived' ? '#3B82F6' : '#F59E0B',
            display: 'inline-block',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.25)',
          }}
        />
        <span>
          {status === 'on_the_way'
            ? 'LIVE EN ROUTE · GOOGLE MAPS'
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
