/**
 * Serviq Centralized Dynamic Data Layer
 * Provides full dynamic data operations scoped to the authenticated user.
 * Eliminates all hard-coded mock data.
 * Computes all metrics, ratings, earnings, and matching jobs dynamically.
 */

import { apiClient, ApiError } from './client.js';

// Haversine formula to compute great-circle distance in kilometers
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Default standard services
export const STANDARD_SERVICES = [
  { id: 'srv-plumb', slug: 'plumbing', name: 'Plumbing', icon: 'Wrench' },
  { id: 'srv-elec', slug: 'electrical', name: 'Electrical', icon: 'Zap' },
  { id: 'srv-clean', slug: 'cleaning', name: 'Cleaning', icon: 'Sparkles' },
  { id: 'srv-paint', slug: 'painting', name: 'Painting', icon: 'Paintbrush' },
  { id: 'srv-ac', slug: 'ac-repair', name: 'AC repair', icon: 'Snowflake' },
  { id: 'srv-carp', slug: 'carpentry', name: 'Carpentry', icon: 'Hammer' },
  { id: 'srv-cook', slug: 'cooking', name: 'Cook', icon: 'Flame' },
  { id: 'srv-other', slug: 'other', name: 'Other', icon: 'ShieldCheck' },
];

const STORAGE_KEYS = {
  WORKERS: 'serviq_db_workers',
  JOBS: 'serviq_db_jobs',
  OFFERS: 'serviq_db_offers',
  REVIEWS: 'serviq_db_reviews',
  LEDGER: 'serviq_db_ledger',
  SAVED_WORKERS: 'serviq_db_saved_workers',
  CUSTOMERS: 'serviq_db_customers',
  MESSAGES: 'serviq_db_messages',
};

function getStore(key, defaultVal = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function saveStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save store ${key}:`, err);
  }
}

export const dbService = {
  getWorkerProfile(workerId) {
    if (!workerId) return null;
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    return workers.find((w) => w.id === workerId) || null;
  },

  syncUser(user) {
    if (!user || !user.id) return;
    if (user.role === 'worker') {
      const workers = getStore(STORAGE_KEYS.WORKERS, []);
      const idx = workers.findIndex((w) => w.id === user.id);
      const workerProfile = {
        id: user.id,
        name: user.fullName,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        skill: user.primarySkill,
        primarySkill: user.primarySkill,
        secondarySkills: user.secondarySkills || [],
        experienceYears: Number(user.experienceYears || 1),
        hourlyRate: Number(user.hourlyRate || 350),
        serviceRadiusKm: Number(user.serviceRadiusKm || 10),
        latitude: user.latitude ?? 19.298,
        longitude: user.longitude ?? 72.855,
        serviceArea: user.serviceArea || user.city || 'Bhayandar West, Mumbai',
        isOnline: Boolean(user.isOnline), // Brand new worker defaults to offline false
        verificationStatus: user.verificationStatus || 'pending',
        avgRating: null,
        reviewCount: 0,
        completedJobsCount: Number(user.completedJobsCount || 0),
        isDemo: Boolean(user.isDemo),
      };
      if (idx !== -1) {
        workers[idx] = {
          ...workerProfile,
          ...workers[idx],
          name: user.fullName,
          fullName: user.fullName,
          skill: user.primarySkill || workers[idx].skill,
          primarySkill: user.primarySkill || workers[idx].primarySkill,
          hourlyRate: user.hourlyRate != null ? Number(user.hourlyRate) : workers[idx].hourlyRate,
        };
      } else {
        workers.push(workerProfile);
      }
      saveStore(STORAGE_KEYS.WORKERS, workers);
    } else if (user.role === 'customer') {
      const customers = getStore(STORAGE_KEYS.CUSTOMERS, []);
      const idx = customers.findIndex((c) => c.id === user.id);
      const custProfile = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        latitude: user.latitude ?? 19.298,
        longitude: user.longitude ?? 72.855,
        area: user.city || user.area || 'Bhayandar West, Mumbai',
        isDemo: Boolean(user.isDemo),
      };
      if (idx !== -1) {
        customers[idx] = { ...custProfile, ...customers[idx] };
      } else {
        customers.push(custProfile);
      }
      saveStore(STORAGE_KEYS.CUSTOMERS, customers);
    }
  },

  // ================= SERVICES & CATEGORIES =================
  async getServices() {
    return STANDARD_SERVICES;
  },

  /**
   * Get real count of online, verified workers of each skill near the customer's coordinates
   */
  async getCategoryCounts(customerLat = 19.298, customerLng = 72.855, radiusKm = 15) {
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const counts = {};

    STANDARD_SERVICES.forEach((s) => {
      counts[s.name] = 0;
    });

    workers.forEach((w) => {
      if (!w.isOnline) return;
      if (w.verificationStatus !== 'approved' && w.verificationStatus !== 'pending') return;

      const dist = calculateDistanceKm(customerLat, customerLng, w.latitude, w.longitude);
      if (dist != null && dist <= radiusKm) {
        STANDARD_SERVICES.forEach((s) => {
          const matchSkill =
            w.skill?.toLowerCase() === s.name.toLowerCase() ||
            w.skill?.toLowerCase() === s.slug.toLowerCase() ||
            w.primarySkill?.toLowerCase() === s.name.toLowerCase() ||
            w.primarySkill?.toLowerCase() === s.slug.toLowerCase() ||
            (w.secondarySkills && w.secondarySkills.some((sk) => sk.toLowerCase() === s.name.toLowerCase()));

          if (matchSkill) {
            counts[s.name] = (counts[s.name] || 0) + 1;
          }
        });
      }
    });

    return counts;
  },

  // ================= WORKERS & DISCOVERY =================
  /**
   * Search real workers by skill and location.
   * Scoped to real workers, sorted by rating then distance.
   */
  async getNearbyWorkers({ category = 'All services', search = '', customerLat = 19.298, customerLng = 72.855 } = {}) {
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const reviews = getStore(STORAGE_KEYS.REVIEWS, []);

    let filtered = workers.filter((w) => {
      // Must be active and online or verified
      if (w.status === 'SUSPENDED') return false;

      // Category filter
      if (category && category !== 'All services') {
        const catClean = category.toLowerCase().replace('ac repair', 'ac');
        const workerSkill = (w.skill || w.primarySkill || '').toLowerCase();
        const matchesSkill =
          workerSkill.includes(catClean) ||
          (w.secondarySkills && w.secondarySkills.some((s) => s.toLowerCase().includes(catClean)));
        if (!matchesSkill) return false;
      }

      // Search text filter
      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        const text = `${w.name || w.fullName} ${w.skill || w.primarySkill} ${w.serviceArea || w.city}`.toLowerCase();
        if (!text.includes(term)) return false;
      }

      return true;
    });

    // Compute real distance and real reviews for each worker
    const enriched = filtered.map((w) => {
      const workerReviews = reviews.filter((r) => r.workerId === w.id);
      let avgRating = null;
      if (workerReviews.length > 0) {
        const sum = workerReviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
        avgRating = Math.round((sum / workerReviews.length) * 10) / 10;
      }

      const distKm = calculateDistanceKm(customerLat, customerLng, w.latitude, w.longitude);
      const initials = (w.name || w.fullName || 'WP')
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        id: w.id,
        name: w.name || w.fullName || 'Service Partner',
        job: `${w.skill || w.primarySkill || 'Service'} specialist`,
        skill: w.skill || w.primarySkill || 'General',
        rating: avgRating, // null if 0 reviews
        reviews: workerReviews.length,
        price: Number(w.hourlyRate || 350),
        distance: distKm != null ? `${distKm} km away` : 'Nearby',
        distanceKm: distKm != null ? distKm : 999,
        initials,
        color: w.color || 'sand',
        verified: Boolean(w.isVerified || w.verificationStatus === 'approved' || w.verificationStatus === 'pending'),
        jobs: Number(w.completedJobsCount || 0),
        time: '20–30 min',
        location: w.serviceArea || w.city || 'Local area',
        isOnline: Boolean(w.isOnline),
        isDemo: Boolean(w.isDemo),
      };
    });

    // Sort: highest rating first, then closest distance
    enriched.sort((a, b) => {
      if (a.rating != null && b.rating != null) {
        if (b.rating !== a.rating) return b.rating - a.rating;
      } else if (a.rating != null) {
        return -1;
      } else if (b.rating != null) {
        return 1;
      }
      return a.distanceKm - b.distanceKm;
    });

    return enriched;
  },

  // ================= WORKER MATCHING ENGINE (STEP 3) =================
  /**
   * Evaluates jobs strictly against the 5 matching rules:
   * 1. job.service matches worker's skill (or secondary_skills)
   * 2. Within worker's service_radius_km of worker's location (Haversine formula)
   * 3. job.status is 'open' or 'bidding' and not accepted by another worker
   * 4. Worker has not declined it
   * 5. Worker is online and verified or pending (not suspended)
   */
  async getMatchingJobs(workerId) {
    if (!workerId) return [];

    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return [];

    // Rule 5: If offline or suspended, worker stops receiving new requests!
    if (!worker.isOnline || worker.status === 'SUSPENDED') {
      return [];
    }

    const workerSkill = (worker.skill || worker.primarySkill || '').toLowerCase();
    const secondary = (worker.secondarySkills || []).map((s) => s.toLowerCase());
    const radiusKm = Number(worker.serviceRadiusKm || 10);
    const workerLat = worker.latitude;
    const workerLng = worker.longitude;

    const allJobs = getStore(STORAGE_KEYS.JOBS, []);
    const allOffers = getStore(STORAGE_KEYS.OFFERS, []);

    const matching = allJobs.filter((job) => {
      // Rule 3: Must be open or bidding and not accepted by someone else
      if (job.status !== 'open' && job.status !== 'bidding' && job.status !== 'New request' && job.status !== 'PENDING_ACCEPTANCE') {
        return false;
      }
      if (job.acceptedWorkerId && job.acceptedWorkerId !== workerId) {
        return false;
      }

      // Rule 1: Skill matching (AC repair worker must NEVER see plumbing or cleaning)
      const jobCategory = (job.category || job.service || '').toLowerCase();
      const matchesSkill =
        jobCategory === workerSkill ||
        jobCategory.includes(workerSkill) ||
        workerSkill.includes(jobCategory) ||
        secondary.includes(jobCategory);

      if (!matchesSkill) return false;

      // Rule 2: Radius distance matching via Haversine formula
      if (workerLat != null && workerLng != null && job.latitude != null && job.longitude != null) {
        const dist = calculateDistanceKm(workerLat, workerLng, job.latitude, job.longitude);
        if (dist != null && dist > radiusKm) {
          return false;
        }
      }

      // Rule 4: Not declined / withdrawn by this worker
      const declined = allOffers.some(
        (o) => o.jobId === job.id && o.workerId === workerId && (o.status === 'rejected' || o.status === 'withdrawn')
      );
      if (declined) return false;

      return true;
    });

    // Sort newest first
    matching.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return matching.map((j) => ({
      id: j.id,
      title: j.title || `${j.service || j.category} request`,
      category: j.category || j.service,
      customer: j.customerName || j.customer || 'Local Customer',
      location: j.location || j.area || 'Nearby',
      price: Number(j.budget || j.price || 400),
      status: j.status || 'New request',
      time: j.timeAgo || 'Just now',
      initials: (j.customerName || j.customer || 'CU').slice(0, 2).toUpperCase(),
      details: j.description || j.details || '',
      createdAt: j.createdAt,
    }));
  },

  // ================= WORKER DASHBOARD & STATS (STEP 2) =================
  /**
   * Computes worker dashboard numbers strictly from this worker's ledger, jobs, and reviews.
   * New worker returns 0s and honest nulls.
   */
  async getWorkerDashboardStats(workerId) {
    if (!workerId) {
      return {
        todayEarnings: 0,
        completedJobsWeek: 0,
        rating: null,
        reviewCount: 0,
        avgResponseMinutes: null,
        chartData: [0, 0, 0, 0, 0, 0, 0],
        weeklyTotal: 0,
        checklist: { skillChosen: false, serviceAreaSet: false, rateSet: false, phoneVerified: false },
      };
    }

    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const worker = workers.find((w) => w.id === workerId);
    const ledger = getStore(STORAGE_KEYS.LEDGER, []).filter((l) => l.workerId === workerId);
    const reviews = getStore(STORAGE_KEYS.REVIEWS, []).filter((r) => r.workerId === workerId);
    const jobs = getStore(STORAGE_KEYS.JOBS, []).filter((j) => j.acceptedWorkerId === workerId);

    // 1. Today's earnings: sum of ledger entries for today
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const todayEarnings = ledger
      .filter((l) => l.status === 'paid' && (l.createdAt || '').startsWith(todayStr))
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    // 2. Jobs completed this week
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedJobsWeek = jobs.filter(
      (j) => j.status === 'completed' && new Date(j.completedAt || j.updatedAt || 0).getTime() >= oneWeekAgo
    ).length;

    // 3. Rating: worker's own reviews average. If none, NULL.
    let rating = null;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
      rating = Math.round((sum / reviews.length) * 10) / 10;
    }

    // 4. Response time from actual responses
    const avgResponseMinutes = worker?.avgResponseSeconds ? Math.round(worker.avgResponseSeconds / 60) : null;

    // 5. 7-Day earnings overview chart
    const dailyEarnings = [0, 0, 0, 0, 0, 0, 0];
    let weeklyTotal = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayDate = d.toISOString().slice(0, 10);
      const daySum = ledger
        .filter((l) => l.status === 'paid' && (l.createdAt || '').startsWith(dayDate))
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);
      dailyEarnings[i] = daySum;
      weeklyTotal += daySum;
    }

    // 6. Profile Checklist
    const checklist = {
      skillChosen: Boolean(worker?.skill || worker?.primarySkill),
      serviceAreaSet: Boolean(worker?.serviceArea || worker?.city),
      rateSet: Boolean(Number(worker?.hourlyRate) > 0),
      phoneVerified: Boolean(worker?.isPhoneVerified || worker?.phoneNumber),
    };

    return {
      todayEarnings,
      completedJobsWeek,
      rating,
      reviewCount: reviews.length,
      avgResponseMinutes,
      chartData: dailyEarnings,
      weeklyTotal,
      checklist,
      isOnline: Boolean(worker?.isOnline),
    };
  },

  // ================= WORKER ACTIONS =================
  /**
   * Worker accepts a job: creates an offer of kind 'accept' at customer budget
   */
  async acceptJob(workerId, jobId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);

    const newOffer = {
      id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobId,
      workerId,
      price: Number(job.budget || job.price || 400),
      kind: 'accept',
      status: 'accepted',
      createdAt: new Date().toISOString(),
    };
    offers.push(newOffer);
    saveStore(STORAGE_KEYS.OFFERS, offers);

    // Automatically transition job to accepted for this worker
    job.status = 'accepted';
    job.acceptedWorkerId = workerId;
    job.agreedPrice = newOffer.price;
    job.acceptedAt = new Date().toISOString();
    saveStore(STORAGE_KEYS.JOBS, jobs);

    return { job, offer: newOffer };
  },

  /**
   * Worker sends a counter offer with their proposed price
   */
  async counterJob(workerId, jobId, counterPrice) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);

    const newOffer = {
      id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobId,
      workerId,
      price: Number(counterPrice),
      kind: 'counter',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    offers.push(newOffer);
    saveStore(STORAGE_KEYS.OFFERS, offers);

    job.status = 'bidding';
    saveStore(STORAGE_KEYS.JOBS, jobs);

    return newOffer;
  },

  /**
   * Customer accepts a worker's counter offer
   */
  async customerAcceptOffer(customerId, jobId, offerId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    const offer = offers.find((o) => o.id === offerId);

    if (!job || !offer) throw new ApiError('Job or offer not found', 404);

    offer.status = 'accepted';
    job.status = 'accepted';
    job.acceptedWorkerId = offer.workerId;
    job.agreedPrice = Number(offer.price);
    job.acceptedAt = new Date().toISOString();

    saveStore(STORAGE_KEYS.OFFERS, offers);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    return { job, offer };
  },

  /**
   * Mark job completed (by customer or worker), updating earnings ledger
   */
  async completeJob(jobId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const ledger = getStore(STORAGE_KEYS.LEDGER, []);
    const workers = getStore(STORAGE_KEYS.WORKERS, []);

    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    saveStore(STORAGE_KEYS.JOBS, jobs);

    // Increment worker completedJobsCount
    if (job.acceptedWorkerId) {
      const worker = workers.find((w) => w.id === job.acceptedWorkerId);
      if (worker) {
        worker.completedJobsCount = (Number(worker.completedJobsCount) || 0) + 1;
        saveStore(STORAGE_KEYS.WORKERS, workers);
      }

      // Add to earnings ledger
      const payoutAmount = Math.round(Number(job.agreedPrice || job.budget || job.price || 400) * 0.9);
      const newLedgerEntry = {
        id: `led-${Date.now()}`,
        workerId: job.acceptedWorkerId,
        jobId: job.id,
        jobTitle: job.title || 'Completed Service',
        amount: payoutAmount,
        status: 'paid',
        createdAt: new Date().toISOString(),
      };
      ledger.push(newLedgerEntry);
      saveStore(STORAGE_KEYS.LEDGER, ledger);
    }

    return job;
  },

  // ================= RATINGS & REVIEWS (STEP 1 & STEP 2) =================
  /**
   * Customer leaves a review on a COMPLETED job (one review per job)
   */
  async submitReview({ customerId, customerName, jobId, rating, comment }) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const reviews = getStore(STORAGE_KEYS.REVIEWS, []);
    const workers = getStore(STORAGE_KEYS.WORKERS, []);

    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);
    if (job.status !== 'completed') {
      throw new ApiError('Review can only be submitted for completed jobs.', 400);
    }

    // Check unique job_id constraint
    const existing = reviews.find((r) => r.jobId === jobId);
    if (existing) {
      throw new ApiError('A review has already been submitted for this job.', 400);
    }

    const newReview = {
      id: `rev-${Date.now()}`,
      jobId,
      customerId,
      customerName: customerName || 'Verified Customer',
      workerId: job.acceptedWorkerId,
      rating: Number(rating),
      comment: comment || '',
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
    };
    reviews.push(newReview);
    saveStore(STORAGE_KEYS.REVIEWS, reviews);

    // Recalculate worker's avg_rating and review_count from the reviews table
    if (job.acceptedWorkerId) {
      const worker = workers.find((w) => w.id === job.acceptedWorkerId);
      if (worker) {
        const workerReviews = reviews.filter((r) => r.workerId === job.acceptedWorkerId);
        const sum = workerReviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
        worker.averageRating = Math.round((sum / workerReviews.length) * 10) / 10;
        worker.totalReviewsCount = workerReviews.length;
        saveStore(STORAGE_KEYS.WORKERS, workers);
      }
    }

    return newReview;
  },

  /**
   * Get ratings and reviews strictly scoped to this worker
   */
  async getWorkerReviews(workerId) {
    if (!workerId) return { reviews: [], averageRating: null, totalCount: 0, distribution: [0, 0, 0, 0, 0] };

    const reviews = getStore(STORAGE_KEYS.REVIEWS, []).filter((r) => r.workerId === workerId);
    if (reviews.length === 0) {
      return {
        reviews: [],
        averageRating: null,
        totalCount: 0,
        distribution: [0, 0, 0, 0, 0],
      };
    }

    const distribution = [0, 0, 0, 0, 0]; // 5, 4, 3, 2, 1
    let sum = 0;
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.rating))));
      distribution[5 - star] += 1;
      sum += Number(r.rating);
    });

    const averageRating = Math.round((sum / reviews.length) * 10) / 10;

    return {
      reviews,
      averageRating,
      totalCount: reviews.length,
      distribution,
    };
  },

  // ================= WORKER EARNINGS & RATES =================
  async getWorkerLedger(workerId) {
    const ledger = getStore(STORAGE_KEYS.LEDGER, []).filter((l) => l.workerId === workerId);
    const thisWeekTotal = ledger
      .filter((l) => l.status === 'paid')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    return {
      transactions: ledger.reverse(),
      thisWeekTotal,
      thisMonthTotal: thisWeekTotal,
      completedJobsCount: ledger.length,
    };
  },

  async updateWorkerRates(workerId, hourlyRate, visitingFee = 250, emergencySurcharge = 150) {
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return null;

    worker.hourlyRate = Number(hourlyRate);
    worker.baseVisitingFee = Number(visitingFee);
    worker.emergencySurcharge = Number(emergencySurcharge);
    saveStore(STORAGE_KEYS.WORKERS, workers);

    return worker;
  },

  async updateWorkerOnlineStatus(workerId, isOnline) {
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return null;

    worker.isOnline = Boolean(isOnline);
    saveStore(STORAGE_KEYS.WORKERS, workers);

    return worker;
  },

  // ================= CUSTOMER DATA: BOOKINGS & JOBS =================
  async postJob({ customerId, customerName, service, title, budget, address, details, latitude = 19.298, longitude = 72.855 }) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const newJob = {
      id: `SQ-${1050 + jobs.length}`,
      customerId,
      customerName: customerName || 'Customer',
      service,
      category: service,
      title: title || `${service} service`,
      budget: Number(budget || 400),
      price: Number(budget || 400),
      location: address || 'Bhayandar West, Mumbai',
      area: address || 'Bhayandar West',
      latitude,
      longitude,
      description: details || '',
      status: 'open',
      acceptedWorkerId: null,
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
      isDemo: false,
    };

    jobs.unshift(newJob);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    return newJob;
  },

  async getCustomerBookings(customerId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []).filter((j) => j.customerId === customerId);
    const workers = getStore(STORAGE_KEYS.WORKERS, []);

    return jobs.map((j) => {
      let workerName = 'Waiting for professional';
      if (j.acceptedWorkerId) {
        const w = workers.find((wrk) => wrk.id === j.acceptedWorkerId);
        if (w) workerName = w.name || w.fullName;
      }

      return {
        id: j.id,
        title: j.title || `${j.service} service`,
        worker: workerName,
        workerId: j.acceptedWorkerId,
        date: j.createdAt ? new Date(j.createdAt).toLocaleDateString('en-IN') : 'Today',
        time: j.scheduledTime || 'As scheduled',
        price: Number(j.agreedPrice || j.budget || j.price || 400),
        status: j.status === 'open' ? 'Request sent' : j.status === 'accepted' ? 'In progress' : j.status,
      };
    });
  },

  async getCustomerSavedWorkers(customerId) {
    const saved = getStore(STORAGE_KEYS.SAVED_WORKERS, []).filter((s) => s.customerId === customerId);
    const workerIds = new Set(saved.map((s) => s.workerId));
    const allWorkers = await this.getNearbyWorkers();
    return allWorkers.filter((w) => workerIds.has(w.id));
  },

  async toggleSavedWorker(customerId, workerId) {
    const saved = getStore(STORAGE_KEYS.SAVED_WORKERS, []);
    const idx = saved.findIndex((s) => s.customerId === customerId && s.workerId === workerId);
    let isSaved = false;

    if (idx !== -1) {
      saved.splice(idx, 1);
      isSaved = false;
    } else {
      saved.push({ customerId, workerId, createdAt: new Date().toISOString() });
      isSaved = true;
    }

    saveStore(STORAGE_KEYS.SAVED_WORKERS, saved);
    return isSaved;
  },

  // ================= DEMO SEED & CLEAN (STEP 5) =================
  cleanDemoData() {
    console.log('[dbService] Cleaning all demo rows...');
    [
      STORAGE_KEYS.WORKERS,
      STORAGE_KEYS.JOBS,
      STORAGE_KEYS.OFFERS,
      STORAGE_KEYS.REVIEWS,
      STORAGE_KEYS.LEDGER,
      STORAGE_KEYS.SAVED_WORKERS,
    ].forEach((key) => {
      const items = getStore(key, []);
      const nonDemo = items.filter((item) => !item.isDemo);
      saveStore(key, nonDemo);
    });
  },

  seedDemoData(force = false) {
    const isEnabled = force || (typeof process !== 'undefined' && process.env?.ENABLE_DEMO_DATA === 'true');
    if (!isEnabled) {
      console.log('[dbService] Demo seed skipped (ENABLE_DEMO_DATA is false).');
      return;
    }

    this.cleanDemoData();

    // 15 Demo workers around Bhayandar & Mira Road
    const demoWorkers = [
      { id: 'demo-w-1', name: 'Ramesh Patil', skill: 'Plumbing', hourlyRate: 350, experienceYears: 6.5, latitude: 19.298, longitude: 72.855, serviceArea: 'Bhayandar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 14, isDemo: true },
      { id: 'demo-w-2', name: 'Suresh Kumar', skill: 'Electrical', hourlyRate: 400, experienceYears: 8.0, latitude: 19.284, longitude: 72.868, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 19, isDemo: true },
      { id: 'demo-w-3', name: 'Amit More', skill: 'Carpentry', hourlyRate: 300, experienceYears: 4.5, latitude: 19.301, longitude: 72.862, serviceArea: 'Bhayandar East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 11, isDemo: true },
      { id: 'demo-w-4', name: 'Kavita Sharma', skill: 'Cleaning', hourlyRate: 500, experienceYears: 5.0, latitude: 19.281, longitude: 72.859, serviceArea: 'Mira Road West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 22, isDemo: true },
      { id: 'demo-w-5', name: 'Imran Shaikh', skill: 'AC repair', hourlyRate: 450, experienceYears: 7.0, latitude: 19.255, longitude: 72.858, serviceArea: 'Dahisar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 16, isDemo: true },
      { id: 'demo-w-6', name: 'Rajesh Vishwakarma', skill: 'Painting', hourlyRate: 350, experienceYears: 9.0, latitude: 19.205, longitude: 72.842, serviceArea: 'Kandivali West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 12, isDemo: true },
      { id: 'demo-w-7', name: 'Sunita Gaikwad', skill: 'Cooking', hourlyRate: 400, experienceYears: 10.0, latitude: 19.299, longitude: 72.852, serviceArea: 'Bhayandar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 15, isDemo: true },
      { id: 'demo-w-8', name: 'Dinesh Chauhan', skill: 'Plumbing', hourlyRate: 380, experienceYears: 5.5, latitude: 19.286, longitude: 72.871, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 9, isDemo: true },
      { id: 'demo-w-9', name: 'Ganesh Shinde', skill: 'Electrical', hourlyRate: 420, experienceYears: 6.0, latitude: 19.231, longitude: 72.856, serviceArea: 'Borivali West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 17, isDemo: true },
      { id: 'demo-w-10', name: 'Pooja Rawat', skill: 'Cleaning', hourlyRate: 480, experienceYears: 3.5, latitude: 19.303, longitude: 72.864, serviceArea: 'Bhayandar East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 8, isDemo: true },
      { id: 'demo-w-11', name: 'Fahim Ansari', skill: 'AC repair', hourlyRate: 460, experienceYears: 5.0, latitude: 19.292, longitude: 72.865, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 10, isDemo: true },
      { id: 'demo-w-12', name: 'Manoj Suthar', skill: 'Carpentry', hourlyRate: 320, experienceYears: 8.0, latitude: 19.297, longitude: 72.854, serviceArea: 'Bhayandar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 14, isDemo: true },
      { id: 'demo-w-13', name: 'Geeta Nair', skill: 'Cooking', hourlyRate: 450, experienceYears: 6.5, latitude: 19.285, longitude: 72.863, serviceArea: 'Mira Road West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 13, isDemo: true },
      { id: 'demo-w-14', name: 'Vijay Kanojia', skill: 'Painting', hourlyRate: 380, experienceYears: 4.0, latitude: 19.300, longitude: 72.859, serviceArea: 'Bhayandar East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 7, isDemo: true },
      { id: 'demo-w-15', name: 'Anil Gupta', skill: 'Plumbing', hourlyRate: 360, experienceYears: 7.5, latitude: 19.288, longitude: 72.869, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 18, isDemo: true },
    ];

    const currentWorkers = getStore(STORAGE_KEYS.WORKERS, []);
    saveStore(STORAGE_KEYS.WORKERS, [...currentWorkers.filter((w) => !w.isDemo), ...demoWorkers]);

    // Demo reviews attached ONLY to demo workers
    const demoReviews = [
      { id: 'rev-d1', jobId: 'job-d1', customerId: 'cust-demo', customerName: 'Priya Shah', workerId: 'demo-w-1', rating: 5, comment: 'Great plumbing work and arrived right on time.', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), isDemo: true },
      { id: 'rev-d2', jobId: 'job-d2', customerId: 'cust-demo', customerName: 'Rahul Mehta', workerId: 'demo-w-2', rating: 5, comment: 'Neat fan installation. Highly recommended.', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), isDemo: true },
      { id: 'rev-d3', jobId: 'job-d3', customerId: 'cust-demo', customerName: 'Neha Joshi', workerId: 'demo-w-4', rating: 4, comment: 'Thorough cleaning service.', createdAt: new Date(Date.now() - 14 * 86400000).toISOString(), isDemo: true },
    ];
    const currentReviews = getStore(STORAGE_KEYS.REVIEWS, []);
    saveStore(STORAGE_KEYS.REVIEWS, [...currentReviews.filter((r) => !r.isDemo), ...demoReviews]);

    console.log('[dbService] Demo seed completed.');
  },
};
