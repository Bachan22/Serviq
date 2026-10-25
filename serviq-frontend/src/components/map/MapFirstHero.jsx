import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { dbService } from '../../api/database.js';
import { discoveryApi } from '../../api/discovery.js';
import { createMapProvider } from './createMapProvider.js';
import './mapStyles.css';
import {
  MapPin,
  Navigation,
  Plus,
  Minus,
  RotateCcw,
  BadgeCheck,
  Star,
  Check,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  LogIn,
  Search,
  Tag,
} from 'lucide-react';
import VoiceInputButton from '../voice/VoiceInputButton.jsx';

export const PRESET_LOCATIONS = [
  { name: 'Bhayandar West, Mumbai', lat: 19.298, lng: 72.855 },
  { name: 'Mira Road East, Mumbai', lat: 19.284, lng: 72.868 },
  { name: 'Borivali West, Mumbai', lat: 19.231, lng: 72.856 },
  { name: 'Kandivali West, Mumbai', lat: 19.205, lng: 72.842 },
];

export default function MapFirstHero({
  onBook,
  onPostJob,
  onViewProfile,
  notify,
  search: externalSearch = '',
  onSearchChange,
  category: externalCategory = 'All',
  onCategoryChange,
  onWorkersLoaded,
}) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Location state: Customer location default (falls back in order: profile lat/lng -> profile area -> default Mumbai)
  const defaultLocation = useMemo(() => ({
    lat: user?.latitude != null ? Number(user.latitude) : 19.298,
    lng: user?.longitude != null ? Number(user.longitude) : 72.855,
  }), [user?.latitude, user?.longitude]);

  const [customerLocation, setCustomerLocation] = useState(defaultLocation);
  const [areaName, setAreaName] = useState(user?.area || user?.city || 'Bhayandar West, Mumbai');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [areaDraft, setAreaDraft] = useState('');

  // Search parameters
  const [radiusKm, setRadiusKm] = useState(5);
  const [selectedService, setSelectedService] = useState(
    externalCategory && externalCategory !== 'All services' ? externalCategory : 'All'
  );
  const [searchQuery, setSearchQuery] = useState(externalSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(externalSearch || '');
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceMatchedService, setVoiceMatchedService] = useState(null);
  const [bounds, setBounds] = useState(null);

  // Workers data
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active worker card / highlighted marker
  const [activeWorker, setActiveWorker] = useState(null);
  const [highlightedWorkerId, setHighlightedWorkerId] = useState(null);
  const [mobileTab, setMobileTab] = useState('map');

  // Map instance references
  const mapContainerRef = useRef(null);
  const mapProviderRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (onSearchChange) onSearchChange(searchQuery);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearchChange]);

  // Sync externalCategory if changed from outside
  useEffect(() => {
    if (externalCategory) {
      const clean = externalCategory === 'All services' ? 'All' : externalCategory;
      setSelectedService(clean);
    }
  }, [externalCategory]);

  // Available service categories
  const availableCategories = useMemo(() => [
    'All',
    'AC repair',
    'Plumbing',
    'Electrical',
    'Cleaning',
    'Painting',
    'Carpentry',
    'Cooking',
  ], []);

  // Fetch nearby online workers
  const fetchNearbyWorkers = useCallback(async (isPolling = false) => {
    if (!customerLocation.lat || !customerLocation.lng) return;

    if (!isPolling) setLoading(true);
    setError(null);

    try {
      const data = await dbService.getNearbyWorkers({
        lat: customerLocation.lat,
        lng: customerLocation.lng,
        radiusKm,
        serviceSlug: selectedService === 'All' ? '' : selectedService,
        search: debouncedSearch,
      });

      const list = data || [];
      setWorkers(list);
      if (onWorkersLoaded) onWorkersLoaded(list);

      // Update map markers
      if (mapProviderRef.current) {
        mapProviderRef.current.setMarkers(list, !isAuthenticated);
      }
    } catch (err) {
      if (err?.status === 429) {
        setError('You are sending requests too fast. Please wait a moment.');
      } else {
        setError('Unable to load nearby professionals. Check your connection.');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [customerLocation, radiusKm, selectedService, debouncedSearch, isAuthenticated, onWorkersLoaded]);

  // Initialize Map Provider
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const provider = createMapProvider();
    mapProviderRef.current = provider;

    provider
      .init(mapContainerRef.current, customerLocation, 14)
      .then(() => {
        provider.setUserLocation(customerLocation.lat, customerLocation.lng);
        provider.setRadius(radiusKm);

        // Marker click callback - syncs card & scrolls into view
        provider.onMarkerClick((w) => {
          setActiveWorker(w);
          setHighlightedWorkerId(w.id);
          provider.highlightMarker(w.id);
          const rowEl = document.getElementById(`worker-row-${w.id}`);
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });

        // Background click closes info card
        provider.onMapClick(() => {
          setActiveWorker(null);
          setHighlightedWorkerId(null);
          provider.highlightMarker(null);
        });

        // Bounds change callback (debounced 400ms in provider)
        provider.onBoundsChange((newBounds) => {
          setBounds(newBounds);
        });

        // Initial fetch once map is ready
        fetchNearbyWorkers();
      })
      .catch((err) => {
        console.error('[MapFirstHero] Failed to initialize map:', err);
        setError('Map failed to load. Please try again.');
        setLoading(false);
      });

    return () => {
      if (mapProviderRef.current) {
        mapProviderRef.current.destroy();
        mapProviderRef.current = null;
      }
    };
  }, []);

  // Update radius on map provider when radiusKm changes
  useEffect(() => {
    if (mapProviderRef.current) {
      mapProviderRef.current.setRadius(radiusKm);
    }
    fetchNearbyWorkers();
  }, [radiusKm, selectedService]);

  // Real-time polling every 10 seconds for worker online/offline updates
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(() => {
      fetchNearbyWorkers(true);
    }, 10000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchNearbyWorkers]);

  // Keyboard navigation: Escape closes card
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveWorker(null);
        setHighlightedWorkerId(null);
        if (mapProviderRef.current) {
          mapProviderRef.current.highlightMarker(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Geolocation trigger: "Use my location"
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      if (notify) notify('Geolocation is not supported by your browser.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCustomerLocation(newCoords);

        if (mapProviderRef.current) {
          mapProviderRef.current.setUserLocation(newCoords.lat, newCoords.lng);
          mapProviderRef.current.panTo(newCoords.lat, newCoords.lng, 14);
        }

        // Reverse geocode to area name
        const detectedArea = await discoveryApi.reverseGeocode(newCoords.lat, newCoords.lng);
        if (detectedArea) {
          setAreaName(detectedArea);
          if (notify) notify(`Location updated to ${detectedArea}`);
        }
      },
      (err) => {
        let msg = 'Unable to access your location. Using saved address.';
        if (err.code === 1) msg = 'Location permission was denied. Using saved area.';
        if (notify) notify(msg, 'warning');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Recenter map on user
  const handleRecenter = () => {
    if (mapProviderRef.current && customerLocation.lat && customerLocation.lng) {
      mapProviderRef.current.panTo(customerLocation.lat, customerLocation.lng, 14);
    }
  };

  // List row click: pan map to marker and open info card
  const handleSelectWorker = (w) => {
    setActiveWorker(w);
    setHighlightedWorkerId(w.id);
    if (mapProviderRef.current) {
      mapProviderRef.current.highlightMarker(w.id);
      mapProviderRef.current.panTo(w.lat, w.lng, 15);
    }
  };

  // List row hover: highlight marker
  const handleHoverWorker = (workerId) => {
    setHighlightedWorkerId(workerId);
    if (mapProviderRef.current) {
      mapProviderRef.current.highlightMarker(workerId);
    }
  };

  return (
    <section className={`map-hero-card mobile-view-${mobileTab}`} aria-label="Nearby Service Professionals Map">
      {/* ================= LEFT PANEL: SEARCH & WORKER LIST ================= */}
      <div className="map-hero-left">
        {/* Mobile View Toggle (Shown only on mobile/tablet) */}
        <div className="map-mobile-tabs" role="tablist" aria-label="Mobile View Switcher">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'map'}
            className={`map-mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`}
            onClick={() => {
              setMobileTab('map');
              setTimeout(() => mapProviderRef.current?.recalculateSize(), 80);
            }}
          >
            <MapPin size={13} /> Map View
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'list'}
            className={`map-mobile-tab-btn ${mobileTab === 'list' ? 'active' : ''}`}
            onClick={() => setMobileTab('list')}
          >
            Available Pros ({workers.length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
          <div className="map-hero-pill">
            <Sparkles size={11} /> NEARBY NOW
          </div>
          <div className="demo-mode-badge" title="Local synthetic worker profiles for development and testing">
            Demo Mode: Synthetic Telemetry
          </div>
        </div>

        <h1 className="map-hero-heading">
          See who can
          <em>come to you.</em>
        </h1>

        <p className="map-hero-subtext">
          Verified professionals working around <strong>{areaName}</strong>, right now.
        </p>

        {/* Location Bar with "Use my location" button */}
        <div className="map-location-bar">
          <div
            className="map-location-info"
            onClick={() => setShowLocationPicker((prev) => !prev)}
            title="Click to change location or select nearby area"
            style={{ cursor: 'pointer' }}
          >
            <MapPin size={16} className="map-location-icon" />
            <div className="map-location-text">
              <small>Service Location (Click to change)</small>
              <strong>{areaName}</strong>
            </div>
          </div>

          <button
            type="button"
            className="map-use-location-btn"
            onClick={handleUseMyLocation}
            title="Locate me using GPS"
          >
            <Navigation size={12} /> Use GPS
          </button>
        </div>

        {/* Location Dropdown Picker */}
        {showLocationPicker && (
          <div className="map-location-dropdown" role="dialog" aria-label="Location selector">
            <div className="map-location-dropdown-header">
              <span>Select Service Area</span>
              <button
                type="button"
                className="map-location-dropdown-close"
                onClick={() => setShowLocationPicker(false)}
                aria-label="Close location picker"
              >
                <X size={14} />
              </button>
            </div>
            <div className="map-location-presets">
              {PRESET_LOCATIONS.map((loc) => {
                const isActive = areaName.toLowerCase().includes(loc.name.split(',')[0].toLowerCase());
                return (
                  <button
                    key={loc.name}
                    type="button"
                    className={`map-location-preset-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setCustomerLocation({ lat: loc.lat, lng: loc.lng });
                      setAreaName(loc.name);
                      if (mapProviderRef.current) {
                        mapProviderRef.current.setUserLocation(loc.lat, loc.lng);
                        mapProviderRef.current.panTo(loc.lat, loc.lng, 14);
                      }
                      setShowLocationPicker(false);
                      if (notify) notify(`Location set to ${loc.name}`);
                    }}
                  >
                    <MapPin size={12} />
                    <span>{loc.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="map-location-custom-row">
              <input
                type="text"
                placeholder="Or type custom locality..."
                className="map-location-custom-input"
                value={areaDraft}
                onChange={(e) => setAreaDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && areaDraft.trim()) {
                    setAreaName(areaDraft.trim());
                    setShowLocationPicker(false);
                  }
                }}
              />
              <button
                type="button"
                className="map-location-custom-apply"
                onClick={() => {
                  if (areaDraft.trim()) {
                    setAreaName(areaDraft.trim());
                    setShowLocationPicker(false);
                  }
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Work Description Search Input */}
        <div className="map-search-bar" role="search">
          <Search size={15} className="map-search-icon" />
          <input
            type="text"
            className="map-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Describe work needed (e.g. AC gas leak, tap repair, wiring)..."
            aria-label="Describe work needed"
          />
          {searchQuery && (
            <button
              type="button"
              className="map-search-clear"
              onClick={() => {
                setSearchQuery('');
                setVoiceSearchQuery('');
                setVoiceMatchedService(null);
              }}
              aria-label="Clear search description"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
          <VoiceInputButton
            mode="text"
            onResult={(spokenText, matchedCategory) => {
              const trimmed = (spokenText || '').trim();
              if (trimmed) {
                setSearchQuery(trimmed);
                setVoiceSearchQuery(trimmed);
                if (matchedCategory) {
                  setVoiceMatchedService(matchedCategory);
                  setSelectedService(matchedCategory);
                  if (onCategoryChange) {
                    onCategoryChange(matchedCategory);
                  }
                } else {
                  setVoiceMatchedService(null);
                }
              }
            }}
          />
        </div>

        {/* Dynamic Service Filter Chips */}
        <div className="map-filter-chips" role="tablist" aria-label="Service categories">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={selectedService === cat}
              className={`map-chip ${selectedService === cat ? 'active' : ''}`}
              onClick={() => {
                setSelectedService(cat);
                if (onCategoryChange) {
                  onCategoryChange(cat === 'All' ? 'All services' : cat);
                }
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Voice Search Feedback Line */}
        {voiceSearchQuery && (
          <div
            className="voice-results-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '6px 12px',
              margin: '6px 0',
              borderRadius: '8px',
              background: '#FFF7ED',
              border: '1px solid #FFEDD5',
              fontSize: '12px',
              color: '#9A3412',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>
                Showing results for &ldquo;<strong>{voiceSearchQuery}</strong>&rdquo;
              </span>
              {voiceMatchedService && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    background: '#FF9500',
                    color: '#FFFFFF',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {voiceMatchedService}
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceMatchedService(null);
                      setSelectedService('All');
                      if (onCategoryChange) onCategoryChange('All services');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                    aria-label="Remove category filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setVoiceSearchQuery('');
                setVoiceMatchedService(null);
                setSearchQuery('');
                if (onSearchChange) onSearchChange('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9A3412',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px',
              }}
              aria-label="Clear voice search"
              title="Clear voice search"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Live Count Line */}
        <div className="map-live-line">
          <span className="map-live-beacon" />
          <span>
            {workers.length} {workers.length === 1 ? 'professional' : 'professionals'} available
            {selectedService !== 'All' ? ` for ${selectedService}` : ' nearby'}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
          </span>
        </div>

        {/* Worker List or Status States */}
        {error ? (
          <div className="map-empty-state">
            <AlertCircle size={24} color="#EF4444" />
            <p>{error}</p>
            <button
              className="btn small"
              onClick={() => fetchNearbyWorkers()}
              style={{ background: '#1A1208', color: '#FFFFFF' }}
            >
              Retry
            </button>
          </div>
        ) : loading && workers.length === 0 ? (
          <div style={{ flex: 1, minHeight: '220px', borderRadius: '14px', overflow: 'hidden' }}>
            <div className="map-skeleton-shimmer" />
          </div>
        ) : workers.length === 0 ? (
          <div className="map-empty-state">
            <p>
              No professionals found
              {selectedService !== 'All' ? ` for ${selectedService}` : ''}
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ''} within {radiusKm} km.
            </p>
            <div className="map-empty-actions">
              {debouncedSearch && (
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              )}
              {radiusKm < 10 && (
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => setRadiusKm(10)}
                >
                  Expand radius to 10 km
                </button>
              )}
              {onPostJob && (
                <button
                  type="button"
                  className="btn small"
                  style={{ background: '#FF9500', color: '#1A1208' }}
                  onClick={() => onPostJob(selectedService !== 'All' ? selectedService : undefined)}
                >
                  Post a job request
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="map-worker-list" role="list" aria-label="Available professionals">
            {workers.map((w) => {
              const isSelected = activeWorker?.id === w.id || highlightedWorkerId === w.id;
              const displayName = !isAuthenticated
                ? 'Service Professional'
                : (w.name || `${w.firstName} ${w.lastInitial}`);
              const initials = w.initials || ((w.firstName ? w.firstName[0] : 'P') + (w.lastInitial ? w.lastInitial[0] : ''));

              return (
                <div
                  key={w.id}
                  id={`worker-row-${w.id}`}
                  role="listitem"
                  tabIndex={0}
                  className={`map-worker-row ${isSelected ? 'highlighted' : ''}`}
                  onClick={() => handleSelectWorker(w)}
                  onMouseEnter={() => handleHoverWorker(w.id)}
                  onMouseLeave={() => setHighlightedWorkerId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSelectWorker(w);
                  }}
                  aria-label={`${displayName}, ${w.skill}, available, ₹${w.price || 350}, ${w.distanceKm} km away`}
                >
                  <div className="map-worker-row-left">
                    <div className="map-worker-avatar">
                      {w.avatarUrl ? (
                        <img src={w.avatarUrl} alt={displayName} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="map-worker-info">
                      <div className="map-worker-name-row">
                        <span className="map-worker-name">{displayName}</span>
                        {w.isVerified && (
                          <BadgeCheck size={14} color="#059669" title="ID verified" />
                        )}
                      </div>
                      <div className="map-worker-sub">{w.skill}</div>
                    </div>
                  </div>

                  <div className="map-worker-row-right">
                    <div className="map-worker-price-col">
                      <strong className="map-worker-price">₹{w.price || 350}</strong>
                      <span className="map-worker-price-unit"> / visit</span>
                    </div>
                    <div className="map-worker-distance">
                      {w.avgRating ? `★ ${w.avgRating} · ` : ''}
                      {w.distanceKm} km
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= RIGHT PANEL: THE MAP ================= */}
      <div className="map-hero-right">
        {/* Map Canvas */}
        <div ref={mapContainerRef} className="map-container-inner" />

        {/* Top Control Bar: Radius & Live Status */}
        <div className="map-top-bar">
          <div className="map-badge-live">
            <span className="map-live-beacon" />
            Within {radiusKm} km · updates live
          </div>

          <div className="map-radius-selector" role="group" aria-label="Search radius">
            {[2, 5, 10].map((r) => (
              <button
                key={r}
                type="button"
                className={`map-radius-btn ${radiusKm === r ? 'active' : ''}`}
                onClick={() => setRadiusKm(r)}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Floating Zoom & Recenter Controls */}
        <div className="map-controls-floating">
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => mapProviderRef.current?.zoomIn()}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => mapProviderRef.current?.zoomOut()}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={handleRecenter}
            title="Recenter on me"
            aria-label="Recenter on me"
          >
            <Navigation size={17} />
          </button>
        </div>

        {/* Floating Info Card Anchored to Clicked Worker */}
        {activeWorker && (
          <div className="serviq-info-card" role="dialog" aria-label="Worker details card">
            <button
              type="button"
              className="serviq-info-card-close"
              onClick={() => {
                setActiveWorker(null);
                setHighlightedWorkerId(null);
                mapProviderRef.current?.highlightMarker(null);
              }}
              aria-label="Close card"
            >
              <X size={16} />
            </button>

            <div className="serviq-info-card-header">
              <div className="serviq-info-card-avatar">
                {activeWorker.avatarUrl ? (
                  <img src={activeWorker.avatarUrl} alt={activeWorker.name || activeWorker.firstName} />
                ) : (
                  <span>
                    {activeWorker.initials ||
                      (activeWorker.firstName ? activeWorker.firstName[0] : 'P') +
                        (activeWorker.lastInitial ? activeWorker.lastInitial[0] : '')}
                  </span>
                )}
              </div>
              <div className="serviq-info-card-details">
                <div className="serviq-info-card-name-row">
                  <strong className="serviq-info-card-name">
                    {!isAuthenticated
                      ? 'Service Professional'
                      : (activeWorker.name || `${activeWorker.firstName} ${activeWorker.lastInitial}`)}
                  </strong>
                  {activeWorker.isVerified && (
                    <BadgeCheck size={16} color="#059669" title="ID verified" />
                  )}
                </div>
                <span className="serviq-info-card-skill">{activeWorker.skill}</span>
              </div>
            </div>

            <div className="serviq-info-card-meta">
              <span>
                {activeWorker.avgRating ? `★ ${activeWorker.avgRating} rating` : 'New professional'}
              </span>
              <span>·</span>
              <span>Available now · {activeWorker.distanceKm} km away</span>
            </div>

            {/* Actual Configured Price & Inspection Explanation */}
            <div className="serviq-info-card-price-box">
              <div className="serviq-info-price-row">
                <div>
                  <small className="serviq-price-label">Configured Visit Fee</small>
                  <div className="serviq-price-value">₹{activeWorker.price || 350}</div>
                </div>
                <span className="serviq-price-badge">Inspection Included</span>
              </div>
              <div className="serviq-price-explainer">
                Starting rate covers diagnosis & standard inspection. Parts & materials quoted on-site.
              </div>
            </div>

            {!isAuthenticated ? (
              <button
                type="button"
                className="serviq-btn-book"
                style={{ width: '100%' }}
                onClick={() => navigate('/signup')}
              >
                <LogIn size={14} /> Sign up to see who is available
              </button>
            ) : (
              <div className="serviq-info-card-actions">
                <button
                  type="button"
                  className="serviq-btn-book"
                  onClick={() => {
                    if (onBook) {
                      onBook(
                        {
                          id: activeWorker.id,
                          name: activeWorker.name || `${activeWorker.firstName} ${activeWorker.lastInitial}`,
                          skill: activeWorker.skill,
                          category: activeWorker.skill,
                          price: activeWorker.price || 350,
                          hourlyRate: activeWorker.hourlyRate || activeWorker.price || 350,
                          initials: activeWorker.initials || 'WP',
                          color: activeWorker.color || 'sand',
                          rating: activeWorker.avgRating,
                          job: `${activeWorker.skill} specialist`,
                        },
                        'listed',
                        searchQuery,
                        areaName
                      );
                    }
                  }}
                >
                  Book at ₹{activeWorker.price || 350}
                </button>
                <button
                  type="button"
                  className="serviq-btn-offer"
                  onClick={() => {
                    if (onBook) {
                      onBook(
                        {
                          id: activeWorker.id,
                          name: activeWorker.name || `${activeWorker.firstName} ${activeWorker.lastInitial}`,
                          skill: activeWorker.skill,
                          category: activeWorker.skill,
                          price: activeWorker.price || 350,
                          hourlyRate: activeWorker.hourlyRate || activeWorker.price || 350,
                          initials: activeWorker.initials || 'WP',
                          color: activeWorker.color || 'sand',
                          rating: activeWorker.avgRating,
                          job: `${activeWorker.skill} specialist`,
                        },
                        'negotiate',
                        searchQuery,
                        areaName
                      );
                    }
                  }}
                >
                  Make an offer
                </button>
                <button
                  type="button"
                  className="serviq-btn-profile"
                  onClick={() => {
                    if (onViewProfile) {
                      onViewProfile(activeWorker);
                    } else {
                      navigate(`/customer/explore?worker=${activeWorker.id}`);
                    }
                  }}
                >
                  View profile
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
