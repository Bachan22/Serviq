import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  BadgeCheck,
  MapPin,
  BriefcaseBusiness,
  Clock3,
  CalendarDays,
  ShieldCheck,
  CircleDollarSign,
  ArrowRight,
  Award,
  Globe,
  FileCheck,
  UserCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { dbService } from '../api/database.js';

function money(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

export default function WorkerProfileModal({ workerId, initialWorker, onClose, onBook }) {
  const [profile, setProfile] = useState(() => {
    if (initialWorker && (initialWorker.name || initialWorker.firstName)) {
      const displayName = initialWorker.name || `${initialWorker.firstName} ${initialWorker.lastInitial || ''}`.trim();
      return {
        ...initialWorker,
        name: displayName,
        displayName,
        skill: initialWorker.skill || initialWorker.primarySkill || 'Home Services',
        hourlyRate: initialWorker.price || initialWorker.hourlyRate || 350,
        baseVisitingFee: Math.round((initialWorker.price || initialWorker.hourlyRate || 350) * 0.75),
        serviceArea: initialWorker.location || initialWorker.serviceArea || 'Bhayandar West, Mumbai',
        totalReviewsCount: initialWorker.reviews || initialWorker.totalReviewsCount || 0,
        averageRating: initialWorker.rating || initialWorker.avgRating || null,
        completedJobsCount: initialWorker.jobs || initialWorker.completedJobsCount || 0,
        experienceYears: initialWorker.experienceYears || null,
        secondarySkills: initialWorker.secondarySkills || [],
        reviews: [],
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(!profile);
  const [error, setError] = useState('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load detailed profile
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      const id = workerId || initialWorker?.id;
      if (!id) {
        setLoading(false);
        return;
      }

      setError('');

      try {
        const data = await dbService.getWorkerDetailedProfile(id);
        if (isMounted) {
          if (data) {
            setProfile(data);
          } else if (!profile && initialWorker) {
            setProfile(initialWorker);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('[WorkerProfileModal] Error loading profile:', err);
          if (!profile) setError('Failed to load profile details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [workerId, initialWorker]);


  if (!workerId && !initialWorker) return null;

  const w = profile || initialWorker || {};
  const firstName = (w.name || w.displayName || 'Professional').trim().split(/\s+/)[0];
  const hasReviews = Array.isArray(w.reviews) && w.reviews.length > 0;
  const isOnline = Boolean(w.isOnline);
  const isVerified = Boolean(w.isVerified || w.verificationStatus === 'approved');

  return (
    <div
      className="modal-backdrop worker-profile-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={`${w.name || 'Worker'} Profile`}
    >
      <div className="worker-profile-modal-card">
        {/* Sticky Header */}
        <div className="worker-profile-header">
          <div className="worker-profile-header-left">
            <div className="worker-profile-avatar-wrapper">
              {w.avatarUrl ? (
                <img src={w.avatarUrl} alt={w.name} className="worker-profile-avatar-img" />
              ) : (
                <div className={`avatar ${w.color || 'sand'} lg worker-profile-avatar-fallback`}>
                  {w.initials || firstName[0] || 'W'}
                </div>
              )}
              <span
                className={`worker-profile-online-badge ${isOnline ? 'online' : 'offline'}`}
                title={isOnline ? 'Online & Available' : 'Currently Offline'}
              />
            </div>

            <div className="worker-profile-titles">
              <div className="worker-profile-name-row">
                <h2>{w.name || w.displayName || 'Service Partner'}</h2>
                {isVerified && (
                  <span className="worker-verified-pill" title="Government ID & Trade Skill Verified">
                    <BadgeCheck size={16} /> Verified Partner
                  </span>
                )}
              </div>

              <div className="worker-profile-sub-row">
                <span className="worker-primary-skill-tag">{w.skill || w.primarySkill || 'Home Services'}</span>
                <span className="worker-dot-separator">·</span>
                <span className="worker-location-tag">
                  <MapPin size={13} /> {w.serviceArea || 'Local area'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn worker-profile-close-btn"
            onClick={onClose}
            aria-label="Close profile"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="worker-profile-body">
          {loading && !profile ? (
            <div className="worker-profile-loading">
              <div className="worker-profile-spinner" />
              <p>Loading complete worker profile...</p>
            </div>
          ) : error ? (
            <div className="worker-profile-error">
              <AlertCircle size={24} color="#EF4444" />
              <p>{error}</p>
              <button type="button" className="btn small secondary" onClick={onClose}>
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Key Metric Highlights Strip */}
              <div className="worker-profile-stats-grid">
                <div className="worker-stat-tile">
                  <div className="worker-stat-icon gold">
                    <Star size={18} fill="currentColor" />
                  </div>
                  <div className="worker-stat-info">
                    <strong className="worker-stat-value">
                      {w.averageRating != null ? w.averageRating.toFixed(1) : 'New'}
                    </strong>
                    <span className="worker-stat-label">
                      {w.totalReviewsCount > 0
                        ? `${w.totalReviewsCount} ${w.totalReviewsCount === 1 ? 'review' : 'reviews'}`
                        : 'No ratings yet'}
                    </span>
                  </div>
                </div>

                <div className="worker-stat-tile">
                  <div className="worker-stat-icon blue">
                    <BriefcaseBusiness size={18} />
                  </div>
                  <div className="worker-stat-info">
                    <strong className="worker-stat-value">
                      {w.experienceYears != null ? `${w.experienceYears} yrs` : 'Not provided'}
                    </strong>
                    <span className="worker-stat-label">Professional experience</span>
                  </div>
                </div>

                <div className="worker-stat-tile">
                  <div className="worker-stat-icon green">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="worker-stat-info">
                    <strong className="worker-stat-value">{w.completedJobsCount || 0}</strong>
                    <span className="worker-stat-label">Jobs completed</span>
                  </div>
                </div>

                <div className="worker-stat-tile">
                  <div className="worker-stat-icon purple">
                    <CalendarDays size={18} />
                  </div>
                  <div className="worker-stat-info">
                    <strong className="worker-stat-value">
                      {w.memberSince ? w.memberSince : 'Rollout 2024'}
                    </strong>
                    <span className="worker-stat-label">Serving on Serviq</span>
                  </div>
                </div>
              </div>

              {/* Section: Services & Pricing */}
              <div className="worker-profile-section">
                <h3 className="worker-section-title">
                  <CircleDollarSign size={18} /> Services & Pricing
                </h3>
                <div className="worker-pricing-card">
                  <div className="worker-service-item primary">
                    <div className="worker-service-details">
                      <strong>{w.skill || w.primarySkill || 'Primary Service'}</strong>
                      <p>Full diagnosis, inspection, and standard repair work</p>
                    </div>
                    <div className="worker-service-price">
                      <strong>{money(w.hourlyRate || 350)}</strong>
                      <small>/ visit starting rate</small>
                    </div>
                  </div>

                  {w.baseVisitingFee != null && (
                    <div className="worker-visiting-fee-row">
                      <span>Base consultation & inspection fee</span>
                      <strong>{money(w.baseVisitingFee)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Specializations */}
              <div className="worker-profile-section">
                <h3 className="worker-section-title">
                  <Sparkles size={18} /> Specializations & Trade Skills
                </h3>
                <div className="worker-skills-list">
                  <span className="worker-skill-chip primary">
                    {w.skill || w.primarySkill} <small>(Primary)</small>
                  </span>
                  {Array.isArray(w.secondarySkills) && w.secondarySkills.length > 0 ? (
                    w.secondarySkills.map((sk) => (
                      <span className="worker-skill-chip" key={sk}>
                        {sk}
                      </span>
                    ))
                  ) : (
                    <span className="worker-not-provided-text">No secondary specializations listed.</span>
                  )}
                </div>
              </div>

              {/* Section: Service Area & Availability */}
              <div className="worker-profile-section">
                <h3 className="worker-section-title">
                  <MapPin size={18} /> Service Area & Coverage
                </h3>
                <div className="worker-area-card">
                  <div className="worker-area-row">
                    <div>
                      <strong>{w.serviceArea || 'Bhayandar & Mira Road, Mumbai'}</strong>
                      <p>
                        Coverage radius of {w.serviceRadiusKm || 10} km around base location.
                      </p>
                    </div>
                    <div className={`worker-status-pill ${isOnline ? 'online' : 'offline'}`}>
                      <span className="live-dot" /> {isOnline ? 'Available now' : 'Currently offline'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: About & Background */}
              <div className="worker-profile-section">
                <h3 className="worker-section-title">
                  <UserCheck size={18} /> About this Professional
                </h3>
                <div className="worker-bio-box">
                  {w.bio ? (
                    <p>{w.bio}</p>
                  ) : (
                    <p className="worker-not-provided-text">
                      No personal bio provided by this professional yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Section: Certifications & Languages */}
              <div className="worker-profile-section">
                <div className="worker-two-col-grid">
                  <div>
                    <h4 className="worker-sub-heading">
                      <Award size={16} /> Certifications & Licenses
                    </h4>
                    {w.certifications && Array.isArray(w.certifications) && w.certifications.length > 0 ? (
                      <ul className="worker-meta-list">
                        {w.certifications.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="worker-not-provided-text">Not provided</span>
                    )}
                  </div>

                  <div>
                    <h4 className="worker-sub-heading">
                      <Globe size={16} /> Languages Spoken
                    </h4>
                    {w.languages && Array.isArray(w.languages) && w.languages.length > 0 ? (
                      <div className="worker-languages-row">
                        {w.languages.map((l, i) => (
                          <span key={i} className="worker-lang-chip">
                            {l}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="worker-not-provided-text">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Customer Reviews & Feedback */}
              <div className="worker-profile-section">
                <div className="worker-reviews-head">
                  <h3 className="worker-section-title">
                    <Star size={18} fill="#FF9500" color="#FF9500" /> Customer Reviews & Feedback
                  </h3>
                  {hasReviews && (
                    <span className="worker-reviews-badge">
                      {w.reviews.length} {w.reviews.length === 1 ? 'verified review' : 'verified reviews'}
                    </span>
                  )}
                </div>

                {hasReviews ? (
                  <div className="worker-reviews-list">
                    {w.reviews.map((rev) => (
                      <div className="worker-review-card" key={rev.id}>
                        <div className="worker-review-card-top">
                          <div className="worker-review-author-info">
                            <strong>{rev.customerName || 'Verified Customer'}</strong>
                            <small>
                              {rev.createdAt
                                ? new Date(rev.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Recent customer'}
                            </small>
                          </div>
                          <div className="worker-review-stars">
                            {'★'.repeat(Math.min(5, Math.max(1, rev.rating || 5)))}
                          </div>
                        </div>

                        {rev.comment && <p className="worker-review-comment">{rev.comment}</p>}

                        {rev.workerReply && (
                          <div className="worker-review-reply-box">
                            <small className="worker-reply-author">Response from {firstName}:</small>
                            <p>{rev.workerReply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="worker-no-reviews-box">
                    <Star size={24} color="#CBD5E1" />
                    <p>No customer reviews yet.</p>
                    <small>
                      Reviews and ratings will appear here once this professional completes jobs on Serviq.
                    </small>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="worker-profile-footer">
          <div className="worker-profile-footer-pricing">
            <small>Typical service visit</small>
            <strong className="worker-footer-price">
              {money(w.hourlyRate || 350)} <small>/ visit</small>
            </strong>
          </div>

          <div className="worker-profile-footer-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Back to map
            </button>
            <button
              type="button"
              className="btn primary worker-profile-book-btn"
              onClick={() => {
                onClose?.();
                if (onBook) {
                  onBook(
                    {
                      id: w.id,
                      name: w.name || w.displayName || 'Service Professional',
                      skill: w.skill || w.primarySkill || 'General',
                      category: w.skill || w.primarySkill || 'General',
                      secondarySkills: w.secondarySkills || [],
                      price: w.hourlyRate || 350,
                      hourlyRate: w.hourlyRate || 350,
                      rating: w.averageRating,
                      reviews: w.totalReviewsCount,
                      initials: w.initials,
                      color: w.color || 'sand',
                    },
                    w.skill || w.primarySkill || 'General'
                  );
                }
              }}
            >
              Book {firstName} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
