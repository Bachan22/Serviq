import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../api/database.js';
import { getDrivingRoute } from '../utils/routing.js';
import TrackingMap from './TrackingMap.jsx';
import CustomerJobStepper from './CustomerJobStepper.jsx';
import {
  X,
  Phone,
  MessageCircle,
  Star,
  ShieldCheck,
  MapPin,
  Clock,
  Navigation,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Home,
  ArrowRight,
  ShieldAlert,
  KeyRound,
} from 'lucide-react';

export default function LiveTrackingModal({ bookingId, userId, onClose, onRefreshBookings }) {
  const navigate = useNavigate();
  const [trackingData, setTrackingData] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Load tracking data from API/database
  const loadTracking = useCallback(async () => {
    if (!bookingId) return;
    try {
      const data = await dbService.getJobTracking(bookingId, userId);
      setTrackingData(data);
      setLastFetchTime(Date.now());
      setError(null);
    } catch (err) {
      console.error('Error fetching tracking data:', err);
      setError(err.message || 'Unable to load live tracking details.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, userId]);

  // Initial fetch and regular polling every 3 seconds for real-time feel
  useEffect(() => {
    loadTracking();
    const pollInterval = setInterval(loadTracking, 3000);
    return () => clearInterval(pollInterval);
  }, [loadTracking]);

  // Update "seconds ago" ticker every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastFetchTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastFetchTime]);

  // Calculate or update driving route when worker or destination coordinates change
  useEffect(() => {
    if (!trackingData?.worker?.latitude || !trackingData?.destination?.latitude) {
      return;
    }

    let isSubscribed = true;
    const workerLat = trackingData.worker.latitude;
    const workerLng = trackingData.worker.longitude;
    const destLat = trackingData.destination.latitude;
    const destLng = trackingData.destination.longitude;

    getDrivingRoute(workerLat, workerLng, destLat, destLng).then((res) => {
      if (isSubscribed && res) {
        setRouteInfo(res);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [
    trackingData?.worker?.latitude,
    trackingData?.worker?.longitude,
    trackingData?.destination?.latitude,
    trackingData?.destination?.longitude,
  ]);

  const handleMessageWorker = () => {
    onClose?.();
    navigate('/customer/messages');
  };

  const status = trackingData?.status || 'accepted';
  const isEnRoute = status === 'on_the_way';
  const isArrived = status === 'arrived';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';

  // Compute live ETA
  const displayEta = isArrived
    ? 'Arrived at your door'
    : isInProgress
    ? 'Service underway'
    : isCompleted
    ? 'Completed'
    : routeInfo?.durationMinutes != null
    ? `~${routeInfo.durationMinutes} mins`
    : trackingData?.metrics?.estimatedDurationMinutes != null
    ? `~${trackingData.metrics.estimatedDurationMinutes} mins`
    : 'Calculating…';

  const displayDist = routeInfo?.distanceKm != null
    ? `${routeInfo.distanceKm} km away`
    : trackingData?.metrics?.distanceKm != null
    ? `${trackingData.metrics.distanceKm} km away`
    : 'Calculating distance…';

  return (
    <div className="serviq-tracking-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 17, 21, 0.7)',
      backdropFilter: 'blur(6px)',
      zIndex: 10050,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div className="serviq-tracking-card" style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #F1F5F9',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="live-dot-beacon" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isArrived ? '#3B82F6' : '#10B981',
                display: 'inline-block',
              }} />
              <strong style={{ fontSize: '17px', color: '#0F1115' }}>
                Live Worker Tracking
              </strong>
              <span style={{
                background: '#F1F5F9',
                color: '#64748B',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: '600',
              }}>
                {trackingData?.jobId || bookingId}
              </span>
            </div>
            <small style={{ color: '#64748B', display: 'block', marginTop: '2px' }}>
              {trackingData?.title || 'Home Service Appointment'}
            </small>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={loadTracking}
              type="button"
              className="btn-icon"
              title="Refresh tracking data"
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              type="button"
              className="btn-icon"
              title="Close tracking"
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {error ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              background: '#FEF2F2',
              borderRadius: '12px',
              color: '#DC2626',
              border: '1px solid #FEE2E2',
            }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
              <h4>Unable to load live location</h4>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>{error}</p>
              <button
                className="btn primary small"
                onClick={loadTracking}
                style={{ marginTop: '12px' }}
              >
                Retry
              </button>
            </div>
          ) : isLoading && !trackingData ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748B' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p>Connecting to live worker beacon…</p>
            </div>
          ) : (
            <>
              {/* Job Stepper Tracker */}
              <div style={{ marginBottom: '16px' }}>
                <CustomerJobStepper status={trackingData?.rawStatus || status} />
              </div>

              {/* Start Code Display for Customer */}
              {trackingData?.startCode && (
                <div style={{
                  background: '#FFF7ED',
                  border: '1.5px solid #FDBA74',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <KeyRound size={22} color="#EA580C" />
                    <div>
                      <strong style={{ fontSize: '13px', color: '#9A3412', display: 'block' }}>Customer Start Code</strong>
                      <span style={{ fontSize: '11px', color: '#7C2D12' }}>Share this 4-digit code with your technician to authorize starting service</span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '22px',
                    fontWeight: '800',
                    letterSpacing: '4px',
                    color: '#EA580C',
                    background: '#FFFFFF',
                    border: '1px solid #FED7AA',
                    padding: '4px 14px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    {trackingData.startCode}
                  </div>
                </div>
              )}

              {/* Completion Confirmation for Customer */}
              {status === 'payment_pending' && (
                <div style={{
                  background: '#ECFDF5',
                  border: '1.5px solid #6EE7B7',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#065F46', display: 'block' }}>Technician Completed Service</strong>
                    <span style={{ fontSize: '12px', color: '#047857' }}>Review the completed work and confirm to release the technician's payout (Simulated payment).</span>
                  </div>
                  <button
                    className="btn primary"
                    style={{ background: '#10B981', borderColor: '#10B981', color: '#FFFFFF', fontWeight: 600, padding: '8px 16px', whiteSpace: 'nowrap' }}
                    onClick={async () => {
                      try {
                        await dbService.confirmJobCompletion(bookingId);
                        onRefreshBookings?.();
                        loadTracking();
                      } catch (err) {
                        alert(err.message || 'Failed to confirm job completion');
                      }
                    }}
                  >
                    <CheckCircle2 size={16} /> Confirm job completed
                  </button>
                </div>
              )}

              {/* ETA & Status Ribbon */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#FFFBEB',
                    color: '#FF9900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <small style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Estimated Arrival
                    </small>
                    <strong style={{ fontSize: '16px', color: '#0F1115' }}>
                      {displayEta}
                    </strong>
                  </div>
                </div>

                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#EFF6FF',
                    color: '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Navigation size={20} />
                  </div>
                  <div>
                    <small style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Distance
                    </small>
                    <strong style={{ fontSize: '16px', color: '#0F1115' }}>
                      {displayDist}
                    </strong>
                  </div>
                </div>

                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#ECFDF5',
                    color: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <small style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Live Status
                    </small>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#0F1115' }}>
                        {isArrived
                          ? 'At your location'
                          : isInProgress
                          ? 'In progress'
                          : isEnRoute
                          ? 'On the way'
                          : 'Technician Assigned'}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        · {secondsAgo < 5 ? 'Just now' : `${secondsAgo}s ago`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Leaflet Map */}
              <div style={{ marginBottom: '18px' }}>
                <TrackingMap
                  workerLocation={{
                    lat: trackingData?.worker?.latitude,
                    lng: trackingData?.worker?.longitude,
                  }}
                  destinationLocation={{
                    lat: trackingData?.destination?.latitude,
                    lng: trackingData?.destination?.longitude,
                  }}
                  workerName={trackingData?.worker?.name || 'Service Partner'}
                  destinationAddress={trackingData?.destination?.address || 'Service Destination'}
                  routeCoordinates={routeInfo?.coordinates || []}
                  isRoadRoute={Boolean(routeInfo?.isRoadRoute)}
                  status={status}
                  height="360px"
                />
              </div>

              {/* Road routing disclosure */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#64748B',
                marginBottom: '16px',
                padding: '0 4px',
              }}>
                <span>
                  {routeInfo?.isRoadRoute
                    ? '🗺️ Calculated along verified local roadways via Google Maps Navigation'
                    : '📍 Proximity estimate (calculating navigation route)'}
                </span>
                <span>
                  Pinch or scroll to zoom · Drag to pan
                </span>
              </div>

              {/* Worker Information Card */}
              {trackingData?.worker && (
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#FFF3E0',
                      color: '#E65100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '17px',
                    }}>
                      {(trackingData.worker.name || 'SP').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', color: '#0F1115' }}>
                          {trackingData.worker.name}
                        </h4>
                        <ShieldCheck size={16} color="#10B981" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '13px', color: '#64748B' }}>
                        <span>{trackingData.worker.skill}</span>
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Star size={13} fill="#F59E0B" color="#F59E0B" />
                          <b>{trackingData.worker.rating}</b> ({trackingData.worker.reviewsCount} reviews)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <a
                      href={`tel:${trackingData.worker.phoneNumber || '+919820012345'}`}
                      className="btn secondary"
                      style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                      }}
                    >
                      <Phone size={14} /> Call
                    </a>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleMessageWorker}
                      style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <MessageCircle size={14} /> Message
                    </button>
                  </div>
                </div>
              )}

              {/* Service Destination & Privacy Note */}
              <div style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                padding: '14px 18px',
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}>
                <Home size={16} color="#64748B" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong>Destination: </strong>
                  <span>{trackingData?.destination?.address}</span>
                  <div style={{ marginTop: '4px', color: '#94A3B8', fontSize: '11px' }}>
                    🔒 Privacy Protected: Worker GPS updates are authenticated and restricted strictly to this active booking.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
