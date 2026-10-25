import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { dbService } from '../api/database.js';
import {
  X,
  Star,
  ShieldCheck,
  MapPin,
  Clock,
  ArrowUpDown,
  Check,
  Send,
  Ban,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export default function CustomerOffersModal({ booking, onClose, onRefresh, notify }) {
  const [offers, setOffers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('price'); // 'price' | 'rating' | 'distance'
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [counterOfferTarget, setCounterOfferTarget] = useState(null);
  const [counterPriceInput, setCounterPriceInput] = useState('');
  const [now, setNow] = useState(Date.now());

  const bookingId = booking?.id;

  const loadOffers = useCallback(async () => {
    if (!bookingId) return;
    try {
      const data = await dbService.getJobOffers(bookingId);
      setOffers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[CustomerOffersModal] Error loading offers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  // Initial load and polling every 3 seconds while visible
  useEffect(() => {
    loadOffers();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadOffers();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadOffers]);

  // Clock ticker every second for live countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAccept = async (offer) => {
    if (actionLoadingId) return;
    setActionLoadingId(offer.id);
    try {
      await dbService.customerAcceptOffer(booking.customerId, bookingId, offer.id);
      notify?.(`Offer accepted! ${offer.displayName || 'Technician'} is confirmed for this booking.`);
      onRefresh?.();
      onClose?.();
    } catch (err) {
      alert(err.message || 'Failed to accept offer');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (offer) => {
    if (actionLoadingId) return;
    setActionLoadingId(offer.id);
    try {
      await dbService.customerDeclineOffer(booking.customerId, bookingId, offer.id);
      notify?.(`Declined offer from ${offer.displayName || 'technician'}.`);
      await loadOffers();
      onRefresh?.();
    } catch (err) {
      alert(err.message || 'Failed to reject offer');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendCounter = async (e) => {
    e.preventDefault();
    if (!counterOfferTarget || actionLoadingId) return;
    const priceNum = Number(counterPriceInput);
    if (!priceNum || priceNum < 50 || priceNum > 50000) {
      alert('Please enter a valid counter price between ₹50 and ₹50,000.');
      return;
    }

    setActionLoadingId(counterOfferTarget.id);
    try {
      await dbService.customerCounterOffer(
        booking.customerId,
        bookingId,
        priceNum,
        'Customer proposed price',
        counterOfferTarget.id
      );
      notify?.(`Counter-offer of ₹${priceNum} sent to ${counterOfferTarget.displayName}.`);
      setCounterOfferTarget(null);
      setCounterPriceInput('');
      await loadOffers();
      onRefresh?.();
    } catch (err) {
      alert(err.message || 'Failed to send counter-offer');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter out expired items and calculate remaining seconds
  const activeOffers = useMemo(() => {
    return offers
      .map((o) => {
        const createdMs = new Date(o.createdAt).getTime();
        const expiresMs = o.expiresAt ? new Date(o.expiresAt).getTime() : createdMs + 15 * 60 * 1000;
        const secondsRemaining = Math.max(0, Math.floor((expiresMs - now) / 1000));
        const isExpired = secondsRemaining <= 0 || o.status === 'expired';
        return {
          ...o,
          secondsRemaining,
          isExpired,
        };
      })
      .filter((o) => !o.isExpired && o.status === 'pending');
  }, [offers, now]);

  // Sort offers by criteria
  const sortedOffers = useMemo(() => {
    const list = [...activeOffers];
    if (sortBy === 'price') {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (sortBy === 'distance') {
      list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }
    return list;
  }, [activeOffers, sortBy]);

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
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
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                Offers on your job
              </h3>
              <span
                style={{
                  fontSize: '12px',
                  background: '#FFF3E0',
                  color: '#EA580C',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 700,
                }}
              >
                {activeOffers.length} Live
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
              {booking?.title || 'Service request'} · Listed budget: ₹{booking?.budget || booking?.price || 400}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Sort Controls */}
        <div
          style={{
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #F1F5F9',
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B' }}>
            <ArrowUpDown size={14} />
            <span>Sort by:</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'price', label: 'Lowest price' },
              { id: 'rating', label: 'Best rating' },
              { id: 'distance', label: 'Nearest' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSortBy(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid',
                  cursor: 'pointer',
                  borderColor: sortBy === tab.id ? '#FF9900' : '#E2E8F0',
                  background: sortBy === tab.id ? '#FFF7ED' : '#FFFFFF',
                  color: sortBy === tab.id ? '#EA580C' : '#475569',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Counter Modal Overlay if active */}
        {counterOfferTarget && (
          <div
            style={{
              padding: '16px 24px',
              background: '#F0F9FF',
              borderBottom: '1px solid #BAE6FD',
            }}
          >
            <form onSubmit={handleSendCounter}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px', color: '#0369A1' }}>
                  Counter {counterOfferTarget.displayName}'s offer of ₹{counterOfferTarget.price}
                </strong>
                <button
                  type="button"
                  onClick={() => setCounterOfferTarget(null)}
                  style={{ background: 'none', border: 'none', fontSize: '12px', color: '#0284C7', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  min="50"
                  max="50000"
                  value={counterPriceInput}
                  onChange={(e) => setCounterPriceInput(e.target.value)}
                  placeholder="Enter your proposed rate (₹)"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #7DD3FC',
                    fontSize: '14px',
                  }}
                />
                <button
                  type="submit"
                  disabled={actionLoadingId === counterOfferTarget.id}
                  style={{
                    padding: '8px 16px',
                    background: '#0284C7',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {actionLoadingId === counterOfferTarget.id ? 'Sending…' : (
                    <>
                      <Send size={13} /> Send Counter
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Offers List */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748B' }}>
              Finding matching offers…
            </div>
          ) : sortedOffers.length > 0 ? (
            sortedOffers.map((offer) => {
              const nameParts = (offer.displayName || 'Technician').trim().split(/\s+/);
              const firstName = nameParts[0] || 'Technician';
              const lastInitial = nameParts.length > 1 ? `${nameParts[nameParts.length - 1][0].toUpperCase()}.` : '';
              const displayName = `${firstName} ${lastInitial}`.trim();

              const ratingDisplay = offer.rating ? `⭐ ${Number(offer.rating).toFixed(1)}` : 'New';
              const distanceDisplay = offer.distanceKm != null ? `${offer.distanceKm} km away` : 'Nearby';

              return (
                <div
                  key={offer.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    background: '#FFFFFF',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* Left: Worker profile info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: '#FFF3E0',
                        color: '#EA580C',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '15px',
                        flexShrink: 0,
                      }}
                    >
                      {(displayName[0] || 'T').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '15px', color: '#0F172A' }}>{displayName}</strong>
                        {offer.isVerified && (
                          <span title="Verified Professional" style={{ display: 'flex' }}>
                            <ShieldCheck size={16} color="#10B981" />
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '12px', color: '#64748B' }}>
                        <span>{offer.skill}</span>
                        <span>·</span>
                        <span style={{ fontWeight: 600, color: offer.rating ? '#F59E0B' : '#0284C7' }}>
                          {ratingDisplay}
                        </span>
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={12} /> {distanceDisplay}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Countdown & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                        ₹{offer.price}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: offer.secondsRemaining < 120 ? '#EF4444' : '#64748B',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Clock size={11} />
                        <span>Expires in {formatCountdown(offer.secondsRemaining)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={Boolean(actionLoadingId)}
                        onClick={() => handleAccept(offer)}
                        style={{
                          padding: '7px 14px',
                          background: '#16A34A',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          opacity: actionLoadingId ? 0.6 : 1,
                        }}
                      >
                        {actionLoadingId === offer.id ? 'Accepting…' : 'Accept'}
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(actionLoadingId)}
                        onClick={() => {
                          setCounterOfferTarget(offer);
                          setCounterPriceInput(String(Math.max(50, Number(offer.price) - 25)));
                        }}
                        style={{
                          padding: '7px 12px',
                          background: '#F1F5F9',
                          color: '#0284C7',
                          border: '1px solid #BAE6FD',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: actionLoadingId ? 0.6 : 1,
                        }}
                      >
                        Counter back
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(actionLoadingId)}
                        onClick={() => handleReject(offer)}
                        style={{
                          padding: '7px 10px',
                          background: '#FFFFFF',
                          color: '#EF4444',
                          border: '1px solid #FECACA',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: actionLoadingId ? 0.6 : 1,
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#FFF3E0',
                  color: '#EA580C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Clock size={22} />
              </div>
              <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0F172A' }}>
                Waiting for offers
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                Your request has been broadcast to nearby online technicians. Offers usually arrive within 10–30 seconds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
