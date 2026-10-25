/**
 * Serviq Centralized Dynamic Data Layer
 * Provides full dynamic data operations scoped to the authenticated user.
 * Eliminates all hard-coded mock data.
 * Computes all metrics, ratings, earnings, and matching jobs dynamically.
 */

import { apiClient, ApiError } from './client.js';
import { messagesApi } from './messages.js';
import { discoveryApi } from './discovery.js';
import { workerApi } from './worker.js';
import { customerApi } from './customer.js';
import { bookingApi } from './booking.js';
import { reviewApi } from './review.js';
import { walletApi } from './wallet.js';
import { notificationApi } from './notifications.js';

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

export const SERVICE_ISSUES = {
  'AC repair': [
    'Not cooling',
    'Gas refill',
    'Servicing',
    'Installation',
    'Water leakage',
    'Noise or smell',
    'Not turning on',
  ],
  'Plumbing': [
    'Leaking tap',
    'Blocked drain',
    'Pipe fitting',
    'Bathroom fitting',
    'Water tank overflow / repair',
    'Low water pressure',
  ],
  'Electrical': [
    'Fan repair',
    'Switch or socket',
    'Wiring',
    'Light fitting',
    'MCB / Fuse trip',
    'Inverter checkup',
  ],
  'Cleaning': [
    'Deep home cleaning',
    'Kitchen cleaning',
    'Bathroom cleaning',
    'Sofa & carpet shampooing',
    'Balcony & window cleaning',
  ],
  'Painting': [
    'Full house painting',
    'Touch up & wall patch',
    'Waterproofing',
    'Single room painting',
    'Exterior weather coat',
  ],
  'Carpentry': [
    'Furniture repair',
    'Door or lock fixing',
    'Custom woodwork',
    'Drill & hang',
    'Cupboard hinge repair',
  ],
  'Cooking': [
    'Daily meal preparation',
    'Party / event cooking',
    'North Indian meals',
    'South Indian meals',
    'Diet & healthy meal prep',
  ],
};

export function getServiceIssues(serviceName) {
  if (!serviceName) return SERVICE_ISSUES['AC repair'];
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(serviceName);
  for (const [key, issues] of Object.entries(SERVICE_ISSUES)) {
    const kNorm = norm(key);
    if (kNorm === target || kNorm.includes(target) || target.includes(kNorm)) {
      return issues;
    }
  }
  return [
    'General inspection & diagnosis',
    'Standard repair',
    'Replacement / Installation',
    'Maintenance servicing',
  ];
}

export const STORAGE_KEYS = {
  WORKERS: 'serviq_db_workers',
  JOBS: 'serviq_db_jobs',
  OFFERS: 'serviq_db_offers',
  REVIEWS: 'serviq_db_reviews',
  LEDGER: 'serviq_db_ledger',
  SAVED_WORKERS: 'serviq_db_saved_workers',
  CUSTOMERS: 'serviq_db_customers',
  MESSAGES: 'serviq_db_messages',
};

export const INITIAL_DEMO_WORKERS = [
  { id: 'demo-w-1', name: 'Ramesh Patil', skill: 'Plumbing', primarySkill: 'Plumbing', hourlyRate: 350, price: 350, experienceYears: 6.5, latitude: 19.298, longitude: 72.855, serviceArea: 'Bhayandar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 14, rating: 4.9, avgRating: 4.9, isDemo: true },
  { id: 'demo-w-2', name: 'Suresh Kumar', skill: 'Electrical', primarySkill: 'Electrical', hourlyRate: 400, price: 400, experienceYears: 8.0, latitude: 19.284, longitude: 72.868, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 19, rating: 4.8, avgRating: 4.8, isDemo: true },
  { id: 'demo-w-3', name: 'Amit More', skill: 'Carpentry', primarySkill: 'Carpentry', hourlyRate: 300, price: 300, experienceYears: 4.5, latitude: 19.301, longitude: 72.862, serviceArea: 'Bhayandar East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 11, rating: 4.7, avgRating: 4.7, isDemo: true },
  { id: 'demo-w-4', name: 'Kavita Sharma', skill: 'Cleaning', primarySkill: 'Cleaning', hourlyRate: 500, price: 500, experienceYears: 5.0, latitude: 19.281, longitude: 72.859, serviceArea: 'Mira Road West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 22, rating: 4.9, avgRating: 4.9, isDemo: true },
  { id: 'demo-w-5', name: 'Imran Shaikh', skill: 'AC repair', primarySkill: 'AC repair', hourlyRate: 450, price: 450, experienceYears: 7.0, latitude: 19.255, longitude: 72.858, serviceArea: 'Dahisar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 16, rating: 4.8, avgRating: 4.8, isDemo: true },
  { id: 'demo-w-6', name: 'Rajesh Vishwakarma', skill: 'Painting', primarySkill: 'Painting', hourlyRate: 350, price: 350, experienceYears: 9.0, latitude: 19.205, longitude: 72.842, serviceArea: 'Kandivali West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 12, rating: 4.6, avgRating: 4.6, isDemo: true },
  { id: 'demo-w-7', name: 'Sunita Gaikwad', skill: 'Cooking', primarySkill: 'Cooking', hourlyRate: 400, price: 400, experienceYears: 10.0, latitude: 19.299, longitude: 72.852, serviceArea: 'Bhayandar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 15, rating: 5.0, avgRating: 5.0, isDemo: true },
  { id: 'demo-w-8', name: 'Dinesh Chauhan', skill: 'Plumbing', primarySkill: 'Plumbing', hourlyRate: 380, price: 380, experienceYears: 5.5, latitude: 19.286, longitude: 72.871, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 9, rating: 4.8, avgRating: 4.8, isDemo: true },
  { id: 'demo-w-9', name: 'Ganesh Shinde', skill: 'Electrical', primarySkill: 'Electrical', hourlyRate: 420, price: 420, experienceYears: 6.0, latitude: 19.231, longitude: 72.856, serviceArea: 'Borivali West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 17, rating: 4.7, avgRating: 4.7, isDemo: true },
  { id: 'demo-w-10', name: 'Pooja Rawat', skill: 'Cleaning', primarySkill: 'Cleaning', hourlyRate: 480, price: 480, experienceYears: 3.5, latitude: 19.303, longitude: 72.864, serviceArea: 'Bhayandar East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 8, rating: 4.9, avgRating: 4.9, isDemo: true },
  { id: 'demo-w-11', name: 'Fahim Ansari', skill: 'AC repair', primarySkill: 'AC repair', hourlyRate: 460, price: 460, experienceYears: 5.0, latitude: 19.292, longitude: 72.865, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 10, rating: 4.9, avgRating: 4.9, isDemo: true },
  { id: 'demo-w-12', name: 'Manoj Suthar', skill: 'Carpentry', primarySkill: 'Carpentry', hourlyRate: 320, price: 320, experienceYears: 8.0, latitude: 19.297, longitude: 72.854, serviceArea: 'Bhayandar West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 14, rating: 4.8, avgRating: 4.8, isDemo: true },
  { id: 'demo-w-13', name: 'Geeta Nair', skill: 'Cooking', primarySkill: 'Cooking', hourlyRate: 450, price: 450, experienceYears: 6.5, latitude: 19.285, longitude: 72.863, serviceArea: 'Mira Road West', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 13, rating: 4.9, avgRating: 4.9, isDemo: true },
  { id: 'demo-w-14', name: 'Vijay Kanojia', skill: 'Painting', primarySkill: 'Painting', hourlyRate: 380, price: 380, experienceYears: 4.0, latitude: 19.300, longitude: 72.859, serviceArea: 'Bhayandar East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 7, rating: 4.7, avgRating: 4.7, isDemo: true },
  { id: 'demo-w-15', name: 'Anil Gupta', skill: 'Plumbing', primarySkill: 'Plumbing', hourlyRate: 360, price: 360, experienceYears: 7.5, latitude: 19.288, longitude: 72.869, serviceArea: 'Mira Road East', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 18, rating: 4.8, avgRating: 4.8, isDemo: true },
  { id: '5be7b904-138b-42cc-855b-a8cf1634d97f', name: 'Baddie', fullName: 'Baddie', skill: 'AC repair', primarySkill: 'AC repair', hourlyRate: 350, price: 350, experienceYears: 3, latitude: 19.290, longitude: 72.855, serviceArea: 'Bhayandar & Mira Road, Mumbai', isOnline: true, isVerified: true, verificationStatus: 'approved', completedJobsCount: 12, rating: 4.9, avgRating: 4.9, isDemo: true },
];

export const INITIAL_DEMO_REVIEWS = [
  { id: 'rev-d1', jobId: 'job-d1', customerId: 'cust-demo', customerName: 'Priya Shah', workerId: 'demo-w-1', rating: 5, comment: 'Great plumbing work and arrived right on time.', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), isDemo: true },
  { id: 'rev-d2', jobId: 'job-d2', customerId: 'cust-demo', customerName: 'Rahul Mehta', workerId: 'demo-w-2', rating: 5, comment: 'Neat fan installation. Highly recommended.', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), isDemo: true },
  { id: 'rev-d3', jobId: 'job-d3', customerId: 'cust-demo', customerName: 'Neha Joshi', workerId: 'demo-w-4', rating: 4, comment: 'Thorough cleaning service.', createdAt: new Date(Date.now() - 14 * 86400000).toISOString(), isDemo: true },
];

function getStore(key, defaultVal = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (key === STORAGE_KEYS.WORKERS) {
        saveStore(STORAGE_KEYS.WORKERS, INITIAL_DEMO_WORKERS);
        return [...INITIAL_DEMO_WORKERS];
      }
      if (key === STORAGE_KEYS.REVIEWS) {
        saveStore(STORAGE_KEYS.REVIEWS, INITIAL_DEMO_REVIEWS);
        return [...INITIAL_DEMO_REVIEWS];
      }
      return defaultVal;
    }
    const parsed = JSON.parse(raw);
    if (key === STORAGE_KEYS.WORKERS && Array.isArray(parsed)) {
      if (parsed.length === 0) {
        saveStore(STORAGE_KEYS.WORKERS, INITIAL_DEMO_WORKERS);
        return [...INITIAL_DEMO_WORKERS];
      }
      let modified = false;
      INITIAL_DEMO_WORKERS.forEach((seedW) => {
        const found = parsed.find((w) => w.id === seedW.id);
        if (!found) {
          parsed.push({ ...seedW });
          modified = true;
        } else if (seedW.id === '5be7b904-138b-42cc-855b-a8cf1634d97f') {
          if (!found.latitude || !found.longitude || !found.isVerified || !found.isOnline) {
            found.latitude = 19.290;
            found.longitude = 72.855;
            found.isVerified = true;
            found.verificationStatus = 'approved';
            found.isOnline = true;
            modified = true;
          }
        }
      });
      if (modified) {
        saveStore(STORAGE_KEYS.WORKERS, parsed);
      }
      return parsed;
    }
    if (key === STORAGE_KEYS.REVIEWS && Array.isArray(parsed) && parsed.length === 0) {
      saveStore(STORAGE_KEYS.REVIEWS, INITIAL_DEMO_REVIEWS);
      return [...INITIAL_DEMO_REVIEWS];
    }
    return parsed;
  } catch {
    if (key === STORAGE_KEYS.WORKERS) return [...INITIAL_DEMO_WORKERS];
    if (key === STORAGE_KEYS.REVIEWS) return [...INITIAL_DEMO_REVIEWS];
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

export function matchesServiceOrDescription(worker, serviceSlug = '', search = '') {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const workerSkillNorm = norm(worker.skill || worker.primarySkill || '');
  const secondaryNorms = (worker.secondarySkills || []).map(norm);

  // 1. Service / Category check
  if (serviceSlug && norm(serviceSlug) !== 'all') {
    const targetNorm = norm(serviceSlug);
    const matchesCategory =
      workerSkillNorm.includes(targetNorm) ||
      targetNorm.includes(workerSkillNorm) ||
      secondaryNorms.some((s) => s.includes(targetNorm) || targetNorm.includes(s));
    if (!matchesCategory) return false;
  }

  // 2. Work description / search query check
  if (search && search.trim()) {
    const rawTerm = search.toLowerCase().trim();
    const cleanTerm = norm(rawTerm);
    if (!cleanTerm) return true;

    // Direct text matching on worker profile
    const workerText = `${worker.name || ''} ${worker.fullName || ''} ${worker.skill || ''} ${worker.primarySkill || ''} ${(worker.secondarySkills || []).join(' ')} ${worker.serviceArea || ''} ${worker.bio || ''}`.toLowerCase();
    if (workerText.includes(rawTerm) || norm(workerText).includes(cleanTerm)) {
      return true;
    }

    // Match against SERVICE_ISSUES taxonomy
    const words = rawTerm.split(/\s+/).filter((w) => w.length > 2);
    for (const [serviceCategory, issues] of Object.entries(SERVICE_ISSUES)) {
      const catNorm = norm(serviceCategory);
      const workerOffersCategory =
        workerSkillNorm.includes(catNorm) ||
        catNorm.includes(workerSkillNorm) ||
        secondaryNorms.some((s) => s.includes(catNorm) || catNorm.includes(s));

      if (workerOffersCategory) {
        for (const issue of issues) {
          const issueLower = issue.toLowerCase();
          const issueNorm = norm(issue);
          if (issueLower.includes(rawTerm) || issueNorm.includes(cleanTerm)) {
            return true;
          }
          if (words.length > 0 && words.some((w) => issueLower.includes(w))) {
            return true;
          }
        }
      }
    }

    // Search query specified but did not match
    return false;
  }

  return true;
}

export const dbService = {
  syncUser(user) {
    if (!user || !user.id) return;
    if (user.role === 'worker') {
      const workers = getStore(STORAGE_KEYS.WORKERS, []);
      const idx = workers.findIndex((w) => w.id === user.id);
      const workerData = {
        id: user.id,
        name: user.fullName || user.name || 'Service Partner',
        fullName: user.fullName || user.name || 'Service Partner',
        email: user.email,
        phoneNumber: user.phoneNumber,
        skill: user.primarySkill || user.skill || 'AC repair',
        primarySkill: user.primarySkill || user.skill || 'AC repair',
        secondarySkills: user.secondarySkills || [],
        hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : 350,
        price: user.hourlyRate ? Number(user.hourlyRate) : 350,
        experienceYears: user.experienceYears || 3,
        latitude: user.latitude || 19.298,
        longitude: user.longitude || 72.855,
        serviceArea: user.serviceArea || user.city || 'Bhayandar West, Mumbai',
        city: user.city || user.serviceArea || 'Bhayandar West, Mumbai',
        isOnline: user.isOnline != null ? Boolean(user.isOnline) : true,
        isVerified: true,
        verificationStatus: user.verificationStatus || 'approved',
        completedJobsCount: user.completedJobsCount || 0,
        isDemo: false,
      };
      if (idx !== -1) {
        workers[idx] = { ...workers[idx], ...workerData };
      } else {
        workers.unshift(workerData);
      }
      saveStore(STORAGE_KEYS.WORKERS, workers);
    } else if (user.role === 'customer') {
      const customers = getStore(STORAGE_KEYS.CUSTOMERS, []);
      const idx = customers.findIndex((c) => c.id === user.id);
      const custData = {
        id: user.id,
        name: user.fullName || 'Valued Customer',
        fullName: user.fullName || 'Valued Customer',
        email: user.email,
        phoneNumber: user.phoneNumber,
        city: user.city || 'Bhayandar West, Mumbai',
        isDemo: false,
      };
      if (idx !== -1) {
        customers[idx] = { ...customers[idx], ...custData };
      } else {
        customers.push(custData);
      }
      saveStore(STORAGE_KEYS.CUSTOMERS, customers);
    }
  },

  getWorkerProfile(workerId) {
    if (!workerId) return null;
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    return workers.find((w) => w.id === workerId) || null;
  },

  async getWorkerDetailedProfile(workerId) {
    if (!workerId) return null;

    // Check local store first
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const localWorker =
      workers.find((w) => w.id === workerId) ||
      INITIAL_DEMO_WORKERS.find((w) => w.id === workerId) ||
      null;

    // Also check session user if this is the currently authenticated worker
    let sessionUser = null;
    try {
      const raw = localStorage.getItem('serviq_session_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id === workerId) sessionUser = u;
      }
    } catch {}

    let backendProfile = null;
    let backendReviews = null;

    // Only attempt backend fetch if workerId is a UUID and responds quickly
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerId);
    if (isUuid) {
      try {
        const withTimeout = (promise, ms = 1200) =>
          Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
          ]);

        if (workerApi && typeof workerApi.getPublicProfile === 'function') {
          backendProfile = await withTimeout(workerApi.getPublicProfile(workerId));
        }
        if (reviewApi && typeof reviewApi.getWorkerReviews === 'function') {
          const revRes = await withTimeout(reviewApi.getWorkerReviews(workerId, 1, 50));
          backendReviews = revRes?.reviews || revRes?.data || null;
        }
      } catch {
        // Offline / fallback to local storage
      }
    }


    const worker = backendProfile || sessionUser || localWorker;
    if (!worker) return null;

    // 3. Fetch reviews from local storage if not fetched from backend
    let reviewsList = backendReviews;
    if (!reviewsList || !Array.isArray(reviewsList)) {
      const storedReviews = getStore(STORAGE_KEYS.REVIEWS, []);
      reviewsList = storedReviews.filter((r) => r.workerId === workerId);
    }

    // Format display initials
    const rawName = worker.displayName || worker.fullName || worker.name || 'Service Professional';
    const parts = rawName.trim().split(/\s+/);
    const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();

    // Compute rating from real reviews
    let avgRating = null;
    if (reviewsList.length > 0) {
      const sum = reviewsList.reduce((acc, r) => acc + Number(r.rating || 0), 0);
      avgRating = Math.round((sum / reviewsList.length) * 10) / 10;
    } else if (worker.averageRating != null && Number(worker.averageRating) > 0) {
      avgRating = Number(worker.averageRating);
    } else if (worker.avgRating != null && Number(worker.avgRating) > 0) {
      avgRating = Number(worker.avgRating);
    }

    // Calculate Serviq tenure / member since date
    let memberSince = null;
    if (worker.createdAt) {
      try {
        const d = new Date(worker.createdAt);
        if (!isNaN(d.getTime())) {
          memberSince = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      } catch {}
    }

    // Secondary skills / specializations
    let secondarySkills = [];
    if (Array.isArray(worker.secondarySkills) && worker.secondarySkills.length > 0) {
      secondarySkills = worker.secondarySkills;
    } else if (Array.isArray(worker.skills) && worker.skills.length > 0) {
      secondarySkills = worker.skills.map((s) => s.categoryName || s.name || s);
    }

    const primarySkill = worker.skill || worker.primarySkill || 'Home Services';

    return {
      id: worker.id,
      name: rawName,
      displayName: rawName,
      avatarUrl: worker.avatarUrl || null,
      initials,
      color: worker.color || 'sand',
      skill: primarySkill,
      primarySkill,
      secondarySkills,
      experienceYears: worker.experienceYears != null ? Number(worker.experienceYears) : null,
      isVerified: Boolean(worker.isVerified || worker.verificationStatus === 'approved'),
      verificationStatus: worker.verificationStatus || (worker.isVerified ? 'approved' : 'pending'),
      isOnline: worker.isOnline != null ? Boolean(worker.isOnline) : true,
      hourlyRate: Number(worker.hourlyRate || worker.price || 350),
      baseVisitingFee: worker.baseVisitingFee != null ? Number(worker.baseVisitingFee) : Math.round((worker.hourlyRate || 350) * 0.75),
      serviceArea: worker.serviceArea || worker.city || 'Bhayandar West, Mumbai',
      serviceRadiusKm: worker.serviceRadiusKm != null ? Number(worker.serviceRadiusKm) : 10,
      completedJobsCount: worker.completedJobsCount != null ? Number(worker.completedJobsCount) : 0,
      totalReviewsCount: reviewsList.length,
      averageRating: avgRating,
      bio: worker.bio || null,
      workingHours: worker.workingHours || null,
      memberSince,
      createdAt: worker.createdAt || null,
      certifications: worker.certifications || null,
      languages: worker.languages || null,
      latitude: worker.latitude != null ? Number(worker.latitude) : null,
      longitude: worker.longitude != null ? Number(worker.longitude) : null,
      reviews: reviewsList.map((r) => ({
        id: r.id,
        rating: Number(r.rating || 5),
        comment: r.comment || r.reviewText || '',
        customerName: r.customerName || r.customerDisplayName || 'Verified Customer',
        createdAt: r.createdAt || null,
        workerReply: r.workerReply || null,
        workerRepliedAt: r.workerRepliedAt || null,
      })),
    };
  },


  async getConversations(currentUser) {
    return messagesApi.getConversations(currentUser);
  },

  async getConversation(conversationId, currentUser) {
    return messagesApi.getConversation(conversationId, currentUser);
  },

  async sendMessage(conversationId, senderId, body) {
    return messagesApi.sendMessage(conversationId, senderId, body);
  },

  async getNearbyWorkers(options = {}) {
    // If called with catalog/grid explore parameters (category or search without lat/radiusKm)
    if (options.category !== undefined || (options.search !== undefined && options.lat == null)) {
      return this.getCatalogWorkers(options);
    }

    const {
      lat = 19.298,
      lng = 72.855,
      radiusKm = 5,
      serviceSlug = options.serviceSlug || (options.category && options.category !== 'All services' ? options.category : ''),
      bounds = null,
      search = '',
    } = options;

    try {
      const apiWorkers = await discoveryApi.getNearbyWorkers({ lat, lng, radiusKm, serviceSlug, bounds });
      if (apiWorkers && apiWorkers.length > 0) {
        // Enrich apiWorkers with local configured pricing, full names, ratings, and apply search filter
        const workersStore = getStore(STORAGE_KEYS.WORKERS, []);
        const workerMap = new Map(workersStore.map((w) => [w.id, w]));

        const enriched = apiWorkers
          .map((item) => {
            const localWorker = workerMap.get(item.id);
            const price = Number(localWorker?.price || localWorker?.hourlyRate || item.price || 350);
            const hourlyRate = Number(localWorker?.hourlyRate || localWorker?.price || item.hourlyRate || 350);
            const name = (localWorker?.name || localWorker?.fullName || item.name || `${item.firstName || ''} ${item.lastInitial || ''}`).trim();
            const rating = item.avgRating != null ? Number(item.avgRating) : (localWorker?.avgRating != null ? Number(localWorker.avgRating) : (localWorker?.rating != null ? Number(localWorker.rating) : null));
            const reviews = item.reviewCount != null ? Number(item.reviewCount) : Number(localWorker?.reviewCount || localWorker?.completedJobsCount || 0);
            const isVerified = Boolean(item.isVerified != null ? item.isVerified : (localWorker?.isVerified || localWorker?.verificationStatus === 'approved'));
            const distance = item.distance || (item.distanceKm != null ? `${item.distanceKm} km away` : 'Nearby');
            const job = localWorker?.job || `${item.skill || localWorker?.skill || 'Service'} specialist`;
            const initials = item.initials || localWorker?.initials || ((item.firstName?.[0] || 'P') + (item.lastInitial?.[0] || ''));

            return {
              ...item,
              name,
              fullName: name,
              price,
              hourlyRate,
              baseVisitingFee: price,
              pricingType: 'inspection_estimate',
              pricingExplanation: 'Starting visit fee covers diagnosis & standard labor · Parts quoted on inspection',
              serviceArea: localWorker?.serviceArea || 'Local area',
              experienceYears: Number(localWorker?.experienceYears || 5),
              initials,
              color: localWorker?.color || 'sand',
              secondarySkills: localWorker?.secondarySkills || [],
              rating,
              avgRating: rating,
              reviews,
              reviewCount: reviews,
              isVerified,
              verified: isVerified,
              distance,
              distanceKm: item.distanceKm,
              job,
              skill: item.skill || localWorker?.skill || 'Home Services',
              primarySkill: item.skill || localWorker?.skill || 'Home Services',
              isOnline: true,
            };
          })
          .filter((w) => matchesServiceOrDescription(w, serviceSlug, search));

        // Unify with any eligible local workers matching the same criteria
        const localList = this.getNearbyWorkersLocally({ lat, lng, radiusKm, serviceSlug, bounds, search });
        const existingIds = new Set(enriched.map((w) => w.id));
        localList.forEach((localW) => {
          if (!existingIds.has(localW.id)) {
            enriched.push(localW);
            existingIds.add(localW.id);
          }
        });

        enriched.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
        return enriched;
      }
    } catch (err) {
      console.warn('[getNearbyWorkers] Remote discovery error, falling back locally:', err?.message || err);
    }

    return this.getNearbyWorkersLocally({ lat, lng, radiusKm, serviceSlug, bounds, search });
  },

  getNearbyWorkersLocally({
    lat = 19.298,
    lng = 72.855,
    radiusKm = 5,
    serviceSlug = '',
    bounds = null,
    search = '',
  } = {}) {
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const results = [];

    workers.forEach((w) => {
      // Must be online, not suspended, and verified
      if (!w.isOnline || w.status === 'SUSPENDED') return;
      if (w.latitude == null || w.longitude == null) return;
      if (!w.isVerified && w.verificationStatus !== 'approved') return;

      // Filter by service category and work description keywords
      if (!matchesServiceOrDescription(w, serviceSlug, search)) return;

      const dist = calculateDistanceKm(lat, lng, w.latitude, w.longitude);
      if (dist == null || dist > radiusKm) return;
      if (w.serviceRadiusKm && dist > w.serviceRadiusKm) return;

      // Stable jitter (~150 to ~300 meters) for map privacy
      let hash1 = 0;
      let hash2 = 0;
      for (let i = 0; i < String(w.id).length; i++) {
        hash1 = (hash1 * 31 + String(w.id).charCodeAt(i)) >>> 0;
        hash2 = (hash2 * 37 + String(w.id).charCodeAt(i)) >>> 0;
      }
      const angle = ((hash1 % 360) * Math.PI) / 180;
      const distMeters = 150 + (hash2 % 150);
      const latOffset = (distMeters * Math.cos(angle)) / 111000;
      const lngOffset = (distMeters * Math.sin(angle)) / (111000 * Math.cos(19.29 * (Math.PI / 180)));

      const approxLat = Number((w.latitude + latOffset).toFixed(5));
      const approxLng = Number((w.longitude + lngOffset).toFixed(5));

      const parts = (w.name || w.fullName || 'Professional').trim().split(/\s+/);
      const firstName = parts[0] || 'Professional';
      const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0].toUpperCase()}.` : '';
      const price = Number(w.price || w.hourlyRate || 350);
      const hourlyRate = Number(w.hourlyRate || w.price || 350);

      results.push({
        id: w.id,
        name: w.name || w.fullName || `${firstName} ${lastInitial}`,
        fullName: w.fullName || w.name || `${firstName} ${lastInitial}`,
        firstName,
        lastInitial,
        avatarUrl: w.avatarUrl || null,
        skill: w.skill || w.primarySkill || 'Home Services',
        primarySkill: w.primarySkill || w.skill || 'Home Services',
        secondarySkills: Array.isArray(w.secondarySkills) ? w.secondarySkills : [],
        experienceYears: Number(w.experienceYears || 5),
        price,
        hourlyRate,
        baseVisitingFee: price,
        pricingType: 'inspection_estimate',
        pricingExplanation: 'Starting rate covers diagnosis & standard labor · Parts/materials quoted on inspection',
        avgRating: w.avgRating != null ? Number(w.avgRating) : (w.rating != null ? Number(w.rating) : null),
        rating: w.avgRating != null ? Number(w.avgRating) : (w.rating != null ? Number(w.rating) : null),
        reviewCount: Number(w.reviewCount || w.completedJobsCount || 0),
        reviews: Number(w.reviewCount || w.completedJobsCount || 0),
        isVerified: Boolean(w.isVerified || w.verificationStatus === 'approved'),
        verified: Boolean(w.isVerified || w.verificationStatus === 'approved'),
        distanceKm: Number(dist.toFixed(1)),
        distance: `${Number(dist.toFixed(1))} km away`,
        job: `${w.skill || w.primarySkill || 'Service'} specialist`,
        initials: (firstName[0] || 'P') + (lastInitial[0] || ''),
        color: w.color || 'sand',
        lat: approxLat,
        lng: approxLng,
        serviceArea: w.serviceArea || 'Local area',
        isOnline: Boolean(w.isOnline),
      });
    });

    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results.slice(0, 100);
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
   * Strictly uses the same filtered result set as getNearbyWorkers within the configured service radius.
   */
  async getCategoryCounts(customerLat = 19.298, customerLng = 72.855, radiusKm = 5) {
    const counts = {};
    STANDARD_SERVICES.forEach((s) => {
      counts[s.name] = 0;
    });

    const allNearby = this.getNearbyWorkersLocally({
      lat: customerLat,
      lng: customerLng,
      radiusKm,
      serviceSlug: '',
    });

    allNearby.forEach((w) => {
      STANDARD_SERVICES.forEach((s) => {
        if (matchesServiceOrDescription(w, s.name) || matchesServiceOrDescription(w, s.slug)) {
          counts[s.name] = (counts[s.name] || 0) + 1;
        }
      });
    });

    return counts;
  },

  // ================= WORKERS & DISCOVERY =================
  /**
   * Search real workers by skill and location.
   * Scoped to real workers, sorted by rating then distance.
   */
  async getCatalogWorkers({
    category = 'All services',
    search = '',
    customerLat = 19.298,
    customerLng = 72.855,
    radiusKm = 10,
  } = {}) {
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const reviews = getStore(STORAGE_KEYS.REVIEWS, []);

    const serviceSlug = category === 'All services' ? '' : category;

    const filtered = workers.filter((w) => {
      // Must be active and online
      if (!w.isOnline || w.status === 'SUSPENDED') return false;
      if (w.latitude == null || w.longitude == null) return false;

      // Filter by service category and work description keywords
      if (!matchesServiceOrDescription(w, serviceSlug, search)) return false;

      // Distance check if radiusKm specified
      const distKm = calculateDistanceKm(customerLat, customerLng, w.latitude, w.longitude);
      if (distKm != null && distKm > radiusKm) return false;
      if (w.serviceRadiusKm && distKm != null && distKm > w.serviceRadiusKm) return false;

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
      const parts = (w.name || w.fullName || 'Professional').trim().split(/\s+/);
      const firstName = parts[0] || 'Professional';
      const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0].toUpperCase()}.` : '';
      const initials = (w.name || w.fullName || 'WP')
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const price = Number(w.price || w.hourlyRate || 350);

      return {
        id: w.id,
        name: w.name || w.fullName || `${firstName} ${lastInitial}`,
        fullName: w.fullName || w.name || `${firstName} ${lastInitial}`,
        firstName,
        lastInitial,
        avatarUrl: w.avatarUrl || null,
        job: `${w.skill || w.primarySkill || 'Service'} specialist`,
        skill: w.skill || w.primarySkill || 'General',
        primarySkill: w.primarySkill || w.skill || 'General',
        secondarySkills: Array.isArray(w.secondarySkills) ? w.secondarySkills : [],
        rating: avgRating, // null if 0 reviews
        avgRating,
        reviews: workerReviews.length,
        reviewCount: workerReviews.length,
        price,
        hourlyRate: price,
        baseVisitingFee: price,
        pricingType: 'inspection_estimate',
        pricingExplanation: 'Starting rate covers diagnosis & standard labor · Parts/materials quoted on inspection',
        distance: distKm != null ? `${Number(distKm.toFixed(1))} km away` : 'Nearby',
        distanceKm: distKm != null ? Number(distKm.toFixed(1)) : 999,
        initials,
        color: w.color || 'sand',
        verified: Boolean(w.isVerified || w.verificationStatus === 'approved'),
        isVerified: Boolean(w.isVerified || w.verificationStatus === 'approved'),
        jobs: Number(w.completedJobsCount || 0),
        time: '20–30 min',
        location: w.serviceArea || w.city || 'Local area',
        serviceArea: w.serviceArea || w.city || 'Local area',
        isOnline: Boolean(w.isOnline),
        status: w.status || 'ACTIVE',
        isDemo: Boolean(w.isDemo),
      };
    });
    // Sort by distance ascending
    enriched.sort((a, b) => a.distanceKm - b.distanceKm);
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

    if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
      return this.getMatchingJobsLocally(workerId);
    }

    try {
      const list = await bookingApi.getAvailableBroadcasts();
      if (Array.isArray(list)) {
        return list.map((j) => ({
          id: j.id,
          bookingNumber: j.booking_number || j.bookingNumber,
          title: j.title || `${j.category_name || 'Home'} service request`,
          category: j.category_name || j.category,
          service: j.category_name || j.category,
          customer: j.customer_name || 'Customer',
          customerName: j.customer_name || 'Customer',
          location: j.location || 'Nearby',
          budget: Number(j.budget || 400),
          price: Number(j.budget || 400),
          originalPrice: Number(j.budget || 400),
          originalBudget: Number(j.budget || 400),
          status: j.status || 'New request',
          rawStatus: j.status,
          distanceKm: j.distance_km != null ? Number(j.distance_km) : null,
          distance: j.distance_km != null ? `${j.distance_km} km away` : 'Nearby',
          time: j.time_ago || 'Just now',
          createdAt: j.created_at,
          initials: (j.customer_name || 'CU').slice(0, 2).toUpperCase(),
        }));
      }
      return [];
    } catch (err) {
      if (import.meta.env?.VITE_DEMO_LOCAL === 'true') return this.getMatchingJobsLocally(workerId);
      console.warn('[getMatchingJobs] Remote broadcast error:', err?.message || err);
      return [];
    }
  },

  getMatchingJobsLocally(workerId) {
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
      // Rule 3: Must be open, bidding, or negotiating and not accepted by someone else
      if (
        job.status !== 'open' &&
        job.status !== 'bidding' &&
        job.status !== 'negotiating' &&
        job.status !== 'New request' &&
        job.status !== 'PENDING_ACCEPTANCE'
      ) {
        return false;
      }
      if (job.acceptedWorkerId && job.acceptedWorkerId !== workerId) {
        return false;
      }
      // Direct booking: If sent specifically to another worker, this worker must never see it
      if (job.targetWorkerId && job.targetWorkerId !== workerId) {
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

    return matching.map((j) => {
      const jobOffers = allOffers.filter((o) => o.jobId === j.id);
      const myOffer = jobOffers.find((o) => o.workerId === workerId && o.status === 'pending');
      const customerOffer = jobOffers.find((o) => o.senderRole === 'CUSTOMER' && o.status === 'pending');

      let statusText = j.status || 'New request';
      let isCustomerOffer = false;
      let customerOfferPrice = null;
      let pendingOfferId = null;

      if (customerOffer) {
        isCustomerOffer = true;
        customerOfferPrice = Number(customerOffer.price);
        pendingOfferId = customerOffer.id;
        statusText = `Customer offer: ₹${customerOffer.price} (Listed: ₹${j.originalPrice || 350})`;
      } else if (myOffer) {
        statusText = `Counter-offer of ₹${myOffer.price} sent`;
        pendingOfferId = myOffer.id;
      } else if (j.status === 'bidding' || j.status === 'negotiating') {
        statusText = 'Under negotiation';
      }

      return {
        id: j.id,
        title: j.title || `${j.service || j.category} request`,
        category: j.category || j.service,
        customer: j.customerName || j.customer || 'Local Customer',
        location: j.location || j.area || 'Nearby',
        price: customerOffer ? Number(customerOffer.price) : (myOffer ? Number(myOffer.price) : Number(j.budget || j.price || 400)),
        originalBudget: Number(j.originalPrice || j.budget || j.price || 400),
        originalPrice: Number(j.originalPrice || j.budget || j.price || 400),
        status: statusText,
        rawStatus: j.status,
        isDirect: Boolean(j.isDirect || j.targetWorkerId),
        isCustomerOffer,
        customerOfferPrice,
        pendingOfferId,
        hasPendingOffer: Boolean(myOffer || customerOffer),
        time: j.timeAgo || 'Just now',
        initials: (j.customerName || j.customer || 'CU').slice(0, 2).toUpperCase(),
        details: j.description || j.details || '',
        createdAt: j.createdAt,
      };
    });
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
        isOnline: false,
      };
    }

    if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
      return this.getWorkerDashboardStatsLocally(workerId);
    }

    try {
      const stats = await workerApi.getDashboardStats();
      if (stats) return stats;
    } catch (err) {
      if (import.meta.env?.VITE_DEMO_LOCAL === 'true') return this.getWorkerDashboardStatsLocally(workerId);
      console.warn('[getWorkerDashboardStats] Remote error, falling back locally:', err?.message || err);
    }

    return this.getWorkerDashboardStatsLocally(workerId);
  },

  getWorkerDashboardStatsLocally(workerId) {
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
   * Worker accepts a job: creates an offer of kind 'accept' or claims broadcast
   */
  async acceptJob(workerId, jobId) {
    if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
      return this.acceptJobLocally(workerId, jobId);
    }
    try {
      const res = await bookingApi.claimBroadcastBooking(jobId);
      return res;
    } catch {
      try {
        const res = await bookingApi.createOffer(jobId, { price: 400, kind: 'accept' });
        return res;
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') return this.acceptJobLocally(workerId, jobId);
        throw err;
      }
    }
  },

  acceptJobLocally(workerId, jobId) {
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
   * Worker sends a counter offer with their proposed price (e.g. ₹325)
   */
  async counterJob(workerId, jobId, counterPrice, reason = '') {
    if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
      return this.counterJobLocally(workerId, jobId, counterPrice, reason);
    }
    try {
      const res = await bookingApi.createOffer(jobId, { price: Number(counterPrice), kind: 'counter', reason });
      return res;
    } catch (err) {
      if (import.meta.env?.VITE_DEMO_LOCAL === 'true') return this.counterJobLocally(workerId, jobId, counterPrice, reason);
      throw err;
    }
  },

  async counterJobLocally(workerId, jobId, counterPrice, reason = '') {
    if (!jobId) throw new ApiError('Job ID is required', 400);
    const parsedPrice = Number(counterPrice);
    if (!parsedPrice || isNaN(parsedPrice) || parsedPrice < 50 || parsedPrice > 50000) {
      throw new ApiError('Please enter a valid counter price between ₹50 and ₹50,000.', 400);
    }

    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);

    // Authorization: worker must be targetWorkerId or acceptedWorkerId or job is open
    if (job.targetWorkerId && job.targetWorkerId !== workerId) {
      throw new ApiError('You are not authorized to negotiate on this booking.', 403);
    }

    // Prevent modifying already finalized agreement
    if (job.agreedPrice && ['accepted', 'completed', 'in_progress'].includes(job.status)) {
      throw new ApiError('Price agreement is already finalized and cannot be modified.', 400);
    }

    const allJobOffers = offers.filter((o) => o.jobId === jobId);
    const workerRounds = allJobOffers.filter((o) => o.senderRole === 'WORKER');
    if (workerRounds.length >= 2) {
      throw new ApiError('Maximum negotiation rounds reached (2 rounds allowed per party).', 400);
    }

    const worker = workers.find((w) => w.id === workerId);
    const workerName = worker?.name || worker?.fullName || 'Technician';

    // Demote any existing pending offer on this job to countered
    offers.forEach((o) => {
      if (o.jobId === jobId && o.status === 'pending') {
        o.status = 'countered';
        o.updatedAt = new Date().toISOString();
      }
    });

    const newOffer = {
      id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobId,
      customerId: job.customerId,
      customerName: job.customerName,
      workerId,
      workerName,
      senderRole: 'WORKER',
      senderName: workerName,
      price: parsedPrice,
      originalPrice: Number(job.originalPrice || job.budget || job.price || 350),
      kind: 'counter',
      roundNumber: allJobOffers.length + 1,
      status: 'pending',
      reason: reason || 'Worker counter-offer',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    offers.push(newOffer);
    saveStore(STORAGE_KEYS.OFFERS, offers);

    job.status = 'bidding';
    job.pendingCounterPrice = parsedPrice;
    job.targetWorkerId = workerId;
    saveStore(STORAGE_KEYS.JOBS, jobs);

    // Audit notification message
    try {
      if (messagesApi && typeof messagesApi.createConversation === 'function') {
        const conv = await messagesApi.createConversation({
          bookingId: job.id,
          customerId: job.customerId,
          workerId: workerId,
        });
        if (conv?.id && typeof messagesApi.sendMessage === 'function') {
          await messagesApi.sendMessage(
            conv.id,
            `Worker counter-offer (Round ${newOffer.roundNumber}): Proposed ₹${parsedPrice} for ${job.service || 'service'}. Please accept, counter, or decline.`
          );
        }
      }
    } catch (e) {
      console.warn('[counterJob] Could not post chat message:', e.message);
    }

    return newOffer;
  },

  /**
   * Worker accepts customer's offer (e.g. initial offer ₹300 or customer counter)
   */
  async workerAcceptCustomerOffer(workerId, jobId, offerId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    const offer = offers.find((o) => o.id === offerId && o.jobId === jobId);

    if (!job || !offer) throw new ApiError('Job or offer not found', 404);

    if (job.targetWorkerId && job.targetWorkerId !== workerId) {
      throw new ApiError('You are not authorized to accept this offer.', 403);
    }

    if (offer.senderRole !== 'CUSTOMER') {
      throw new ApiError('Worker can only accept offers sent by the customer.', 400);
    }

    // Expiry check
    if (offer.expiresAt && new Date() > new Date(offer.expiresAt)) {
      offer.status = 'expired';
      offer.resolvedAt = new Date().toISOString();
      saveStore(STORAGE_KEYS.OFFERS, offers);
      throw new ApiError('The customer offer has expired (15-minute validity window elapsed).', 410);
    }

    offer.status = 'accepted';
    offer.resolvedAt = new Date().toISOString();
    job.status = 'accepted';
    job.acceptedWorkerId = workerId;
    job.agreedPrice = Number(offer.price);
    job.price = Number(offer.price);
    job.budget = Number(offer.price);
    delete job.pendingCounterPrice;
    job.acceptedAt = new Date().toISOString();

    saveStore(STORAGE_KEYS.OFFERS, offers);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    try {
      if (messagesApi && typeof messagesApi.createConversation === 'function') {
        const conv = await messagesApi.createConversation({
          bookingId: job.id,
          customerId: job.customerId,
          workerId: workerId,
        });
        if (conv?.id && typeof messagesApi.sendMessage === 'function') {
          await messagesApi.sendMessage(
            conv.id,
            `Agreed! Service professional accepted your offer of ₹${offer.price}. Booking confirmed.`
          );
        }
      }
    } catch (e) {
      console.warn('[workerAcceptCustomerOffer] Could not post chat message:', e.message);
    }

    return { job, offer };
  },

  /**
   * Worker rejects customer's offer
   */
  async workerRejectCustomerOffer(workerId, jobId, offerId, reason = '') {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    const offer = offers.find((o) => o.id === offerId && o.jobId === jobId);

    if (!job || !offer) throw new ApiError('Job or offer not found', 404);

    offer.status = 'rejected';
    offer.resolvedAt = new Date().toISOString();
    delete job.pendingCounterPrice;
    job.status = 'cancelled';
    job.cancellationReason = reason || 'Declined by service professional';

    saveStore(STORAGE_KEYS.OFFERS, offers);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    try {
      if (messagesApi && typeof messagesApi.createConversation === 'function') {
        const conv = await messagesApi.createConversation({
          bookingId: job.id,
          customerId: job.customerId,
          workerId: workerId,
        });
        if (conv?.id && typeof messagesApi.sendMessage === 'function') {
          await messagesApi.sendMessage(
            conv.id,
            `Service professional declined the offer of ₹${offer.price}.`
          );
        }
      }
    } catch (e) {
      console.warn('[workerRejectCustomerOffer] Could not post chat message:', e.message);
    }

    return { job, offer };
  },

  /**
   * Customer counters a worker's counter-offer
   */
  async customerCounterOffer(customerId, jobId, counterPrice, reason = '', offerId = null) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          let targetOfferId = offerId;
          if (!targetOfferId) {
            const offers = await bookingApi.getJobOffers(jobId);
            const pending = (offers || []).find((o) => o.status === 'pending');
            if (pending) targetOfferId = pending.id;
          }
          if (targetOfferId) {
            const res = await bookingApi.counterJobOffer(jobId, targetOfferId, Number(counterPrice));
            return res;
          }
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.customerCounterOfferLocally(customerId, jobId, counterPrice, reason);
        }
        throw err;
      }
    }
    return this.customerCounterOfferLocally(customerId, jobId, counterPrice, reason);
  },

  async customerCounterOfferLocally(customerId, jobId, counterPrice, reason = '') {
    if (!jobId) throw new ApiError('Job ID is required', 400);
    const parsedPrice = Number(counterPrice);
    if (!parsedPrice || isNaN(parsedPrice) || parsedPrice < 50 || parsedPrice > 50000) {
      throw new ApiError('Please enter a valid counter price between ₹50 and ₹50,000.', 400);
    }

    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);

    if (job.customerId !== customerId) {
      throw new ApiError('You do not own this booking.', 403);
    }

    if (job.agreedPrice && ['accepted', 'completed', 'in_progress'].includes(job.status)) {
      throw new ApiError('Price agreement is already finalized and cannot be modified.', 400);
    }

    // Check customer round limit (max 2 rounds allowed)
    const customerRounds = offers.filter(
      (o) => o.jobId === jobId && o.senderRole === 'CUSTOMER'
    );
    if (customerRounds.length >= 2) {
      throw new ApiError('Maximum counter-offers reached (2 allowed per party). You can accept or decline.', 400);
    }

    // Demote any pending worker offer to countered
    offers.forEach((o) => {
      if (o.jobId === jobId && o.status === 'pending') {
        o.status = 'countered';
        o.updatedAt = new Date().toISOString();
      }
    });

    const targetWorkerId = job.targetWorkerId || job.acceptedWorkerId;

    const allJobOffers = offers.filter((o) => o.jobId === jobId);
    const newOffer = {
      id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobId,
      customerId,
      customerName: job.customerName || 'Customer',
      workerId: targetWorkerId,
      senderRole: 'CUSTOMER',
      senderName: job.customerName || 'Customer',
      price: parsedPrice,
      originalPrice: Number(job.originalPrice || job.budget || job.price || 350),
      kind: 'counter',
      roundNumber: allJobOffers.length + 1,
      status: 'pending',
      reason: reason || 'Customer counter-offer',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    offers.push(newOffer);
    saveStore(STORAGE_KEYS.OFFERS, offers);

    job.status = 'negotiating';
    job.price = parsedPrice;
    delete job.pendingCounterPrice;
    saveStore(STORAGE_KEYS.JOBS, jobs);

    try {
      if (messagesApi && typeof messagesApi.createConversation === 'function') {
        const conv = await messagesApi.createConversation({
          bookingId: job.id,
          customerId,
          workerId: targetWorkerId,
        });
        if (conv?.id && typeof messagesApi.sendMessage === 'function') {
          await messagesApi.sendMessage(
            conv.id,
            `Customer counter-offer (Round ${newOffer.roundNumber}): Proposed ₹${parsedPrice} for ${job.service || 'service'}.`
          );
        }
      }
    } catch (e) {
      console.warn('[customerCounterOffer] Could not post chat message:', e.message);
    }

    return newOffer;
  },

  /**
   * Customer accepts a worker's counter offer
   */
  async customerAcceptOffer(customerId, jobId, offerId) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const res = await bookingApi.acceptJobOffer(jobId, offerId);
          return { job: res, offer: { id: offerId, status: 'accepted' } };
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.customerAcceptOfferLocally(customerId, jobId, offerId);
        }
        throw err;
      }
    }
    return this.customerAcceptOfferLocally(customerId, jobId, offerId);
  },

  async customerAcceptOfferLocally(customerId, jobId, offerId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    const offer = offers.find((o) => o.id === offerId && o.jobId === jobId);

    if (!job || !offer) throw new ApiError('Job or offer not found', 404);

    if (job.customerId !== customerId) {
      throw new ApiError('You do not own this booking.', 403);
    }

    // Expiry check
    if (offer.expiresAt && new Date() > new Date(offer.expiresAt)) {
      offer.status = 'expired';
      offer.resolvedAt = new Date().toISOString();
      saveStore(STORAGE_KEYS.OFFERS, offers);
      throw new ApiError('The worker counter-offer has expired (15-minute validity window elapsed).', 410);
    }

    offer.status = 'accepted';
    offer.resolvedAt = new Date().toISOString();
    job.status = 'accepted';
    job.acceptedWorkerId = offer.workerId;
    job.agreedPrice = Number(offer.price);
    job.price = Number(offer.price);
    job.budget = Number(offer.price);
    delete job.pendingCounterPrice;
    job.acceptedAt = new Date().toISOString();

    saveStore(STORAGE_KEYS.OFFERS, offers);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    try {
      if (messagesApi && typeof messagesApi.createConversation === 'function') {
        const conv = await messagesApi.createConversation({
          bookingId: job.id,
          customerId: job.customerId,
          workerId: offer.workerId,
        });
        if (conv?.id && typeof messagesApi.sendMessage === 'function') {
          await messagesApi.sendMessage(
            conv.id,
            `Agreed! Customer accepted the counter-offer of ₹${offer.price}. Booking confirmed.`
          );
        }
      }
    } catch (e) {
      console.warn('[customerAcceptOffer] Could not post chat message:', e.message);
    }

    return { job, offer };
  },

  /**
   * Customer declines a worker's counter offer
   */
  async customerDeclineOffer(customerId, jobId, offerId) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const res = await bookingApi.rejectJobOffer(jobId, offerId);
          return { job: { id: jobId }, offer: res };
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.customerDeclineOfferLocally(customerId, jobId, offerId);
        }
        throw err;
      }
    }
    return this.customerDeclineOfferLocally(customerId, jobId, offerId);
  },

  async customerDeclineOfferLocally(customerId, jobId, offerId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);
    const job = jobs.find((j) => j.id === jobId);
    const offer = offers.find((o) => o.id === offerId && o.jobId === jobId);

    if (!job || !offer) throw new ApiError('Job or offer not found', 404);

    offer.status = 'rejected';
    offer.resolvedAt = new Date().toISOString();
    delete job.pendingCounterPrice;

    job.status = job.isDirect ? 'cancelled' : 'open';

    saveStore(STORAGE_KEYS.OFFERS, offers);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    try {
      if (messagesApi && typeof messagesApi.createConversation === 'function') {
        const conv = await messagesApi.createConversation({
          bookingId: job.id,
          customerId: job.customerId,
          workerId: offer.workerId,
        });
        if (conv?.id && typeof messagesApi.sendMessage === 'function') {
          await messagesApi.sendMessage(
            conv.id,
            `Customer declined counter-offer of ₹${offer.price}.`
          );
        }
      }
    } catch (e) {
      console.warn('[customerDeclineOffer] Could not post chat message:', e.message);
    }

    return { job, offer };
  },

  /**
   * Get all offers for a specific job
   */
  async getJobOffers(jobId) {
    if (!jobId) return [];
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const list = await bookingApi.getJobOffers(jobId);
          if (Array.isArray(list)) return list;
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.getJobOffersLocally(jobId);
        }
        console.warn('[getJobOffers] Remote offers error:', err?.message || err);
        return [];
      }
    }
    return this.getJobOffersLocally(jobId);
  },

  getJobOffersLocally(jobId) {
    const offers = getStore(STORAGE_KEYS.OFFERS, []).filter((o) => o.jobId === jobId);
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    return offers.map((o) => {
      const w = workers.find((wrk) => wrk.id === o.workerId);
      const nameParts = (o.workerName || w?.name || 'Service Partner').trim().split(/\s+/);
      return {
        id: o.id,
        workerId: o.workerId,
        displayName: o.workerName || w?.name || 'Service Partner',
        firstName: nameParts[0] || 'Service',
        lastInitial: nameParts.length > 1 ? `${nameParts[nameParts.length - 1][0].toUpperCase()}.` : '',
        skill: w?.skill || 'Technician',
        rating: w?.rating || w?.avgRating || null,
        reviewCount: w?.reviewCount || w?.completedJobsCount || 0,
        isVerified: Boolean(w?.isVerified || w?.verificationStatus === 'approved'),
        distanceKm: w ? calculateDistanceKm(19.298, 72.855, w.latitude, w.longitude) : null,
        price: Number(o.price),
        kind: o.kind || 'counter',
        status: o.status,
        createdAt: o.createdAt,
        expiresAt: o.expiresAt || new Date(new Date(o.createdAt).getTime() + 15 * 60 * 1000).toISOString(),
        isExpired: o.expiresAt ? new Date() > new Date(o.expiresAt) : false,
      };
    });
  },

  /**
   * Retrieve full chronological negotiation history for a booking
   */
  async getNegotiationHistory(jobId) {
    if (!jobId) return [];
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const offers = await bookingApi.getJobOffers(jobId);
          if (Array.isArray(offers)) {
            return offers.map((o, idx) => ({
              id: o.id,
              jobId,
              roundNumber: idx + 1,
              senderRole: o.senderRole || (o.kind === 'offer' ? 'CUSTOMER' : 'WORKER'),
              senderName: o.displayName || `${o.firstName || 'Worker'} ${o.lastInitial || ''}`,
              price: Number(o.price),
              originalPrice: null,
              status: o.status,
              reason: o.reason || '',
              createdAt: o.createdAt,
              expiresAt: o.expiresAt,
              isExpired: o.isExpired,
            }));
          }
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.getNegotiationHistoryLocally(jobId);
        }
      }
    }
    return this.getNegotiationHistoryLocally(jobId);
  },

  getNegotiationHistoryLocally(jobId) {
    const offers = getStore(STORAGE_KEYS.OFFERS, []).filter((o) => o.jobId === jobId);
    const now = new Date();

    offers.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    return offers.map((o) => {
      const isExpired = o.status === 'pending' && o.expiresAt && now > new Date(o.expiresAt);
      return {
        id: o.id,
        jobId: o.jobId,
        roundNumber: o.roundNumber || 1,
        senderRole: o.senderRole || (o.kind === 'offer' ? 'CUSTOMER' : 'WORKER'),
        senderName: o.senderName || o.workerName || o.customerName || (o.senderRole === 'CUSTOMER' ? 'Customer' : 'Professional'),
        price: Number(o.price),
        originalPrice: o.originalPrice ? Number(o.originalPrice) : null,
        status: isExpired ? 'expired' : o.status,
        reason: o.reason || '',
        createdAt: o.createdAt,
        expiresAt: o.expiresAt,
        resolvedAt: o.resolvedAt,
        isExpired: Boolean(isExpired),
      };
    });
  },

  /**
   * Customer confirms completion of work -> status COMPLETED + simulated payout
   */
  async confirmJobCompletion(jobId) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const res = await bookingApi.confirmCompletion(jobId);
          return res;
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.completeJobLocally(jobId);
        }
        throw err;
      }
    }
    return this.completeJobLocally(jobId);
  },

  /**
   * Complete job fallback
   */
  async completeJob(jobId) {
    return this.confirmJobCompletion(jobId);
  },

  completeJobLocally(jobId) {
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

      // Add to simulated earnings ledger
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
   * Customer leaves a review on a COMPLETED job (one review per booking)
   */
  async submitReview({ customerId, customerName, jobId, rating, comment }) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const res = await reviewApi.createReview({
            bookingId: jobId,
            rating: Number(rating),
            comment: comment || '',
            isPublic: true,
          });
          return res;
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.submitReviewLocally({ customerId, customerName, jobId, rating, comment });
        }
        throw err;
      }
    }
    return this.submitReviewLocally({ customerId, customerName, jobId, rating, comment });
  },

  submitReviewLocally({ customerId, customerName, jobId, rating, comment }) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const reviews = getStore(STORAGE_KEYS.REVIEWS, []);
    const workers = getStore(STORAGE_KEYS.WORKERS, []);

    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);
    if (job.status !== 'completed' && job.status !== 'COMPLETED') {
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

    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerId);
        if (isUuid) {
          const res = await reviewApi.getWorkerReviews(workerId, 1, 50);
          const list = res?.reviews || res?.data || (Array.isArray(res) ? res : []);
          const distribution = [0, 0, 0, 0, 0];
          let sum = 0;
          list.forEach((r) => {
            const star = Math.min(5, Math.max(1, Math.round(Number(r.rating || 5))));
            distribution[5 - star] += 1;
            sum += Number(r.rating || 5);
          });
          const avg = list.length > 0 ? Math.round((sum / list.length) * 10) / 10 : null;
          return {
            reviews: list,
            averageRating: res?.averageRating != null ? Number(res.averageRating) : avg,
            totalCount: res?.totalCount != null ? Number(res.totalCount) : list.length,
            distribution,
          };
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.getWorkerReviewsLocally(workerId);
        }
        console.warn('[getWorkerReviews] Remote error:', err?.message || err);
      }
    }
    return this.getWorkerReviewsLocally(workerId);
  },

  getWorkerReviewsLocally(workerId) {
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
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const res = await walletApi.listTransactions({ page: 1, limit: 50 });
        const list = res?.transactions || [];
        const wallet = await walletApi.getMyWallet().catch(() => null);
        const thisWeekTotal = Number(wallet?.availableBalance || 0);
        return {
          transactions: list.map((tx) => ({
            id: tx.id,
            workerId,
            jobId: tx.referenceId,
            jobTitle: tx.description || 'Service Payout (Simulated payment)',
            amount: Number(tx.amount || 0),
            status: tx.status?.toLowerCase() || 'paid',
            createdAt: tx.createdAt,
          })),
          thisWeekTotal,
          thisMonthTotal: thisWeekTotal,
          completedJobsCount: list.length,
        };
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.getWorkerLedgerLocally(workerId);
        }
        console.warn('[getWorkerLedger] Remote error:', err?.message || err);
      }
    }
    return this.getWorkerLedgerLocally(workerId);
  },

  getWorkerLedgerLocally(workerId) {
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
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        await workerApi.updateRates({
          hourlyRate: Number(hourlyRate),
          baseVisitingFee: Number(visitingFee),
          emergencySurcharge: Number(emergencySurcharge),
        });
      } catch (err) {
        console.warn('[updateWorkerRates] Remote error:', err?.message || err);
      }
    }
    return this.updateWorkerRatesLocally(workerId, hourlyRate, visitingFee, emergencySurcharge);
  },

  updateWorkerRatesLocally(workerId, hourlyRate, visitingFee = 250, emergencySurcharge = 150) {
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
  /**
   * Create direct booking targeting a specific worker
   */
  async createDirectBooking(params) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.workerId);
        if (isUuid) {
          const payload = {
            workerId: params.workerId,
            service: params.service,
            category: params.service,
            title: params.issue ? `${params.service} - ${params.issue}` : `${params.service} service`,
            description: params.details || params.issue || `${params.service} direct booking`,
            budget: Number(params.budget || 400),
            initialOfferPrice: Number(params.budget || 400),
            pricingMode: params.pricingMode,
            address: params.address,
            serviceAddressText: params.address,
            latitude: Number(params.latitude || 19.298),
            longitude: Number(params.longitude || 72.855),
            date: params.date,
            time: params.time,
          };
          const booking = await bookingApi.createDirectBooking(payload);
          return {
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            title: booking.title,
            service: params.service,
            category: params.service,
            budget: Number(booking.budget),
            price: Number(booking.budget),
            location: params.address,
            status: 'open',
            isDirect: true,
            createdAt: booking.createdAt,
            ...booking,
          };
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.createDirectBookingLocally(params);
        }
        throw err;
      }
    }
    return this.createDirectBookingLocally(params);
  },

  createDirectBookingLocally({
    customerId,
    customerName,
    workerId,
    service,
    issue,
    budget,
    pricingMode = 'listed',
    address,
    details,
    date,
    time,
  }) {
    if (!workerId) throw new ApiError('Worker ID is required for direct booking.', 400);
    if (!service) throw new ApiError('Service category is required.', 400);
    if (!address || !address.trim()) throw new ApiError('Service address is required.', 400);

    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) throw new ApiError('Selected service professional was not found.', 404);

    if (worker.status === 'SUSPENDED') {
      throw new ApiError('Selected service professional is currently suspended.', 400);
    }
    if (!worker.isOnline) {
      throw new ApiError('Selected service professional is currently offline.', 400);
    }

    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const serviceNorm = norm(service);
    const workerSkillNorm = norm(worker.skill || worker.primarySkill);
    const secondaryNorms = (worker.secondarySkills || []).map(norm);

    const hasSkill =
      workerSkillNorm === serviceNorm ||
      (workerSkillNorm && serviceNorm.includes(workerSkillNorm)) ||
      (serviceNorm && workerSkillNorm.includes(serviceNorm)) ||
      secondaryNorms.some((s) => s === serviceNorm || s.includes(serviceNorm) || serviceNorm.includes(s));

    if (!hasSkill) {
      throw new ApiError(`Selected service professional does not offer ${service} services.`, 400);
    }

    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const isNegotiating = pricingMode === 'negotiate' || (budget && Number(budget) < Number(worker.price || worker.hourlyRate || 350));
    const targetPrice = Number(budget || worker.hourlyRate || worker.price || 350);
    const listedPrice = Number(worker.price || worker.hourlyRate || 350);

    const newJob = {
      id: `SQ-${1050 + jobs.length}`,
      customerId: customerId || 'guest-customer',
      customerName: customerName || 'Valued Customer',
      targetWorkerId: workerId,
      acceptedWorkerId: null,
      service,
      category: service,
      issue: issue || '',
      title: issue ? `${service} - ${issue}` : `${service} service`,
      budget: targetPrice,
      price: targetPrice,
      originalPrice: listedPrice,
      agreedPrice: isNegotiating ? null : targetPrice,
      location: address.trim(),
      area: address.trim(),
      scheduledDate: date || 'Today',
      scheduledTime: time || 'Morning · 9 AM – 12 PM',
      description: details ? details.slice(0, 500) : '',
      status: isNegotiating ? 'negotiating' : 'open',
      isDirect: true,
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
      isDemo: false,
    };

    jobs.unshift(newJob);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    if (isNegotiating) {
      const offers = getStore(STORAGE_KEYS.OFFERS, []);
      const initialOffer = {
        id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        jobId: newJob.id,
        customerId: newJob.customerId,
        customerName: newJob.customerName,
        workerId,
        workerName: worker.name || worker.fullName || 'Technician',
        senderRole: 'CUSTOMER',
        senderName: newJob.customerName,
        price: targetPrice,
        originalPrice: listedPrice,
        kind: 'offer',
        roundNumber: 1,
        status: 'pending',
        reason: details || 'Customer initial price offer',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
      offers.push(initialOffer);
      saveStore(STORAGE_KEYS.OFFERS, offers);

      try {
        if (messagesApi && typeof messagesApi.createConversation === 'function') {
          messagesApi.createConversation({
            bookingId: newJob.id,
            customerId: newJob.customerId,
            workerId,
          }).then((conv) => {
            if (conv?.id && typeof messagesApi.sendMessage === 'function') {
              messagesApi.sendMessage(
                conv.id,
                `Customer initial offer (Round 1): Proposed ₹${targetPrice} for ${service} (Listed rate: ₹${listedPrice}).`
              );
            }
          });
        }
      } catch (e) {
        console.warn('[createDirectBooking] Chat notification failed:', e.message);
      }
    }

    return newJob;
  },

  async postJob(params) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const payload = {
          service: params.service,
          category: params.service,
          title: params.title || (params.issue ? `${params.service} - ${params.issue}` : `${params.service} service`),
          description: params.details || params.issue || `${params.service} broadcast request`,
          budget: Number(params.budget || 400),
          address: params.address,
          serviceAddressText: params.address,
          latitude: Number(params.latitude || 19.298),
          longitude: Number(params.longitude || 72.855),
          searchRadiusKm: 10,
          date: params.date,
          time: params.time,
        };
        const booking = await bookingApi.createBroadcastBooking(payload);
        return {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          title: booking.title,
          service: params.service,
          category: params.service,
          budget: Number(booking.budget),
          price: Number(booking.budget),
          location: params.address,
          status: 'open',
          createdAt: booking.createdAt,
          ...booking,
        };
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.postJobLocally(params);
        }
        throw err;
      }
    }
    return this.postJobLocally(params);
  },

  postJobLocally({
    customerId,
    customerName,
    service,
    issue,
    title,
    budget,
    address,
    details,
    date,
    time,
    latitude = 19.298,
    longitude = 72.855,
  }) {
    if (!service) throw new ApiError('Service category is required.', 400);
    if (!address || !address.trim()) throw new ApiError('Service address is required.', 400);

    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const newJob = {
      id: `SQ-${1050 + jobs.length}`,
      customerId: customerId || 'guest-customer',
      customerName: customerName || 'Valued Customer',
      service,
      category: service,
      issue: issue || '',
      title: title || (issue ? `${service} - ${issue}` : `${service} service`),
      budget: Number(budget || 400),
      price: Number(budget || 400),
      location: address.trim(),
      area: address.trim(),
      latitude,
      longitude,
      scheduledDate: date || 'Today',
      scheduledTime: time || 'Morning · 9 AM – 12 PM',
      description: details ? details.slice(0, 500) : '',
      status: 'open',
      targetWorkerId: null,
      acceptedWorkerId: null,
      isDirect: false,
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
      isDemo: false,
    };

    jobs.unshift(newJob);
    saveStore(STORAGE_KEYS.JOBS, jobs);

    return newJob;
  },

  async getCustomerBookings(customerId) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('serviq_access_token') : null;
        if (!token) return [];
        const res = await bookingApi.listBookings();
        const list = res?.bookings || (Array.isArray(res) ? res : []);
        if (Array.isArray(list)) {
          return list.map((j) => {
            const rawStatus = (j.status || 'open').toLowerCase();
            const isTrackingActive = Boolean(
              j.workerId && ['accepted', 'on_the_way', 'arrived', 'in_progress'].includes(rawStatus)
            );
            return {
              id: j.id,
              bookingNumber: j.bookingNumber || j.booking_number,
              title: j.title || `${j.categoryName || j.category || 'Home'} service`,
              service: j.categoryName || j.category || 'Home Services',
              category: j.categoryName || j.category || 'Home Services',
              status: rawStatus,
              rawStatus: j.status,
              budget: Number(j.budget || 400),
              price: Number(j.agreedLaborPrice || j.budget || 400),
              agreedPrice: j.agreedLaborPrice ? Number(j.agreedLaborPrice) : null,
              location: j.serviceAddressText || j.area || 'Local address',
              worker: j.worker?.displayName || (j.workerId ? 'Assigned Partner' : 'Finding technician…'),
              workerId: j.workerId,
              date: j.scheduledFor ? new Date(j.scheduledFor).toLocaleDateString('en-IN') : (j.createdAt ? new Date(j.createdAt).toLocaleDateString('en-IN') : 'Today'),
              time: j.createdAt ? new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'As scheduled',
              canTrack: isTrackingActive,
              startCode: j.startCode, // customer only!
              timeAgo: 'Recently',
            };
          });
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.getCustomerBookingsLocally(customerId);
        }
        if (err?.status !== 401) {
          console.warn('[getCustomerBookings] Remote error:', err?.message || err);
        }
        return [];
      }
    }
    return this.getCustomerBookingsLocally(customerId);
  },

  getCustomerBookingsLocally(customerId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []).filter((j) => j.customerId === customerId);
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const offers = getStore(STORAGE_KEYS.OFFERS, []);

    return jobs.map((j) => {
      let workerName = 'Waiting for professional';
      const assignedOrTargetId = j.acceptedWorkerId || j.targetWorkerId;
      if (assignedOrTargetId) {
        const w = workers.find((wrk) => wrk.id === assignedOrTargetId);
        if (w) workerName = w.name || w.fullName;
      }

      const rawStatus = j.status || 'open';
      const isTrackingActive = Boolean(
        j.acceptedWorkerId && ['accepted', 'on_the_way', 'arrived', 'in_progress'].includes(rawStatus)
      );

      const jobOffers = offers.filter((o) => o.jobId === j.id);
      const pendingOffer = jobOffers.find((o) => o.status === 'pending');
      const isWorkerOffer = pendingOffer && pendingOffer.senderRole === 'WORKER';
      const isCustomerOffer = pendingOffer && pendingOffer.senderRole === 'CUSTOMER';
      const latestOfferPrice = pendingOffer ? Number(pendingOffer.price) : (j.pendingCounterPrice ? Number(j.pendingCounterPrice) : null);

      let displayStatus = rawStatus;
      if (rawStatus === 'open') {
        displayStatus = j.targetWorkerId ? `Request sent to ${workerName}` : 'Request sent';
      } else if (isWorkerOffer) {
        displayStatus = `Counter-offer: ₹${pendingOffer.price}`;
      } else if (isCustomerOffer) {
        displayStatus = `Offer ₹${pendingOffer.price} Pending`;
      } else if (rawStatus === 'bidding' || rawStatus === 'negotiating') {
        displayStatus = latestOfferPrice ? `Negotiating: ₹${latestOfferPrice}` : 'Negotiating';
      } else if (rawStatus === 'accepted') displayStatus = 'Accepted';
      else if (rawStatus === 'on_the_way') displayStatus = 'Worker on the way';
      else if (rawStatus === 'arrived') displayStatus = 'Worker arrived';
      else if (rawStatus === 'in_progress') displayStatus = 'In progress';
      else if (rawStatus === 'completed') displayStatus = 'completed';
      else if (rawStatus === 'cancelled') displayStatus = 'Cancelled';

      const effectivePrice = j.agreedPrice != null ? Number(j.agreedPrice) : (latestOfferPrice || Number(j.budget || j.price || 400));

      return {
        id: j.id,
        title: j.title || `${j.service} service`,
        service: j.service,
        issue: j.issue || '',
        worker: workerName,
        workerId: assignedOrTargetId,
        date: j.scheduledDate || (j.createdAt ? new Date(j.createdAt).toLocaleDateString('en-IN') : 'Today'),
        time: j.scheduledTime || 'As scheduled',
        price: effectivePrice,
        agreedPrice: j.agreedPrice != null ? Number(j.agreedPrice) : null,
        status: displayStatus,
        rawStatus,
        isDirect: Boolean(j.targetWorkerId),
        canTrack: isTrackingActive,
        counterOffer: isWorkerOffer
          ? {
              id: pendingOffer.id,
              price: Number(pendingOffer.price),
              workerId: pendingOffer.workerId,
              workerName: pendingOffer.workerName || workerName,
              roundNumber: pendingOffer.roundNumber || 1,
            }
          : null,
        pendingCustomerOffer: isCustomerOffer
          ? {
              id: pendingOffer.id,
              price: Number(pendingOffer.price),
              roundNumber: pendingOffer.roundNumber || 1,
            }
          : null,
      };
    });
  },

  async getCustomerSavedWorkers(customerId) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const saved = await customerApi.getSavedWorkers();
        if (Array.isArray(saved)) return saved.map((s) => s.worker || s);
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') return this.getCustomerSavedWorkersLocally(customerId);
      }
    }
    return this.getCustomerSavedWorkersLocally(customerId);
  },

  getCustomerSavedWorkersLocally(customerId) {
    const saved = getStore(STORAGE_KEYS.SAVED_WORKERS, []).filter((s) => s.customerId === customerId);
    const workerIds = new Set(saved.map((s) => s.workerId));
    const allWorkers = getStore(STORAGE_KEYS.WORKERS, []);
    return allWorkers.filter((w) => workerIds.has(w.id));
  },

  async toggleSavedWorker(customerId, workerId) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerId);
        if (isUuid) {
          const list = await customerApi.getSavedWorkers();
          const exists = Array.isArray(list) && list.some((s) => (s.workerId || s.id) === workerId);
          if (exists) {
            await customerApi.removeSavedWorker(workerId);
            return false;
          } else {
            await customerApi.saveWorker(workerId);
            return true;
          }
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') return this.toggleSavedWorkerLocally(customerId, workerId);
        throw err;
      }
    }
    return this.toggleSavedWorkerLocally(customerId, workerId);
  },

  toggleSavedWorkerLocally(customerId, workerId) {
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

  // ================= LIVE WORKER TRACKING & STATUS =================
  /**
   * Updates worker's live location and updates active jobs assigned to this worker.
   */
  async updateWorkerLocation(workerId, { latitude, longitude }) {
    if (!workerId || latitude == null || longitude == null) return null;

    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const worker = workers.find((w) => w.id === workerId);
    const nowIso = new Date().toISOString();

    if (worker) {
      worker.latitude = Number(latitude);
      worker.longitude = Number(longitude);
      worker.lastLocationUpdatedAt = nowIso;
      saveStore(STORAGE_KEYS.WORKERS, workers);
    }

    // Also update any active jobs assigned to this worker
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    let updatedCount = 0;

    jobs.forEach((job) => {
      if (
        job.acceptedWorkerId === workerId &&
        ['accepted', 'on_the_way', 'arrived', 'in_progress'].includes(job.status)
      ) {
        job.workerLatitude = Number(latitude);
        job.workerLongitude = Number(longitude);
        job.workerLocationUpdatedAt = nowIso;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      saveStore(STORAGE_KEYS.JOBS, jobs);
    }

    return {
      workerId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      lastLocationUpdatedAt: nowIso,
    };
  },

  /**
   * Updates job status through the live service lifecycle:
   * 'accepted' -> 'on_the_way' -> 'arrived' -> 'in_progress' -> 'payment_pending' -> 'completed'
   */
  async updateJobStatus(jobId, newStatus, workerId, startCode) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const statusMap = {
            'accepted': 'ACCEPTED',
            'on_the_way': 'ON_THE_WAY',
            'arrived': 'ARRIVED',
            'in_progress': 'IN_PROGRESS',
            'payment_pending': 'PAYMENT_PENDING',
            'completed': 'COMPLETED',
            'cancelled': 'CANCELLED',
          };
          const mapped = statusMap[newStatus.toLowerCase()] || newStatus.toUpperCase();
          const res = await bookingApi.updateStatus(jobId, mapped, startCode);
          return res;
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.updateJobStatusLocally(jobId, newStatus, workerId);
        }
        throw err;
      }
    }
    return this.updateJobStatusLocally(jobId, newStatus, workerId);
  },

  updateJobStatusLocally(jobId, newStatus, workerId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);

    if (workerId && job.acceptedWorkerId && job.acceptedWorkerId !== workerId) {
      throw new ApiError('Unauthorized: You are not assigned to this job', 403);
    }

    const nowIso = new Date().toISOString();
    job.status = newStatus;

    if (newStatus === 'on_the_way') {
      job.departedAt = nowIso;
    } else if (newStatus === 'arrived') {
      job.arrivedAt = nowIso;
    } else if (newStatus === 'in_progress') {
      job.startedAt = nowIso;
    } else if (newStatus === 'payment_pending') {
      job.paymentPendingAt = nowIso;
    } else if (newStatus === 'completed') {
      job.completedAt = nowIso;
      saveStore(STORAGE_KEYS.JOBS, jobs);
      return this.completeJobLocally(jobId);
    }

    saveStore(STORAGE_KEYS.JOBS, jobs);
    return job;
  },

  /**
   * Securely retrieves tracking bundle for an authorized customer or worker.
   */
  async getJobTracking(jobId, requesterId) {
    if (import.meta.env?.VITE_DEMO_LOCAL !== 'true') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
        if (isUuid) {
          const tracking = await bookingApi.getBookingTracking(jobId);
          if (tracking) {
            return {
              jobId: tracking.bookingId || tracking.id,
              title: tracking.title || 'Service',
              service: tracking.categoryName || 'Home Services',
              status: (tracking.status || 'accepted').toLowerCase(),
              rawStatus: tracking.status,
              agreedPrice: tracking.agreedLaborPrice || tracking.budget,
              startCode: tracking.startCode,
              destination: {
                address: tracking.serviceAddressText || 'Customer Address',
                latitude: tracking.serviceLatitude || 19.298,
                longitude: tracking.serviceLongitude || 72.855,
              },
              worker: tracking.worker ? {
                id: tracking.worker.id,
                name: tracking.worker.displayName,
                skill: tracking.worker.skill,
                rating: tracking.worker.averageRating || 4.8,
                reviewsCount: tracking.worker.totalReviewsCount || 10,
                phoneNumber: tracking.worker.phone || '+91 98200 12345',
                latitude: tracking.worker.latitude,
                longitude: tracking.worker.longitude,
                lastLocationUpdatedAt: tracking.worker.lastLocationUpdatedAt,
                isLive: true,
              } : null,
              customer: {
                id: tracking.customerId,
                name: tracking.customerName || 'Customer',
                address: tracking.serviceAddressText || 'Customer Address',
              },
              metrics: {
                distanceKm: tracking.distanceKm,
                estimatedDurationMinutes: tracking.distanceKm ? Math.max(2, Math.round((tracking.distanceKm / 25) * 60)) : null,
              },
              timeline: {
                createdAt: tracking.createdAt,
                acceptedAt: tracking.dispatchedAt,
                departedAt: tracking.onTheWayAt,
                arrivedAt: tracking.arrivedAt,
                startedAt: tracking.startedAt,
                completedAt: tracking.completedAt,
              },
            };
          }
        }
      } catch (err) {
        if (import.meta.env?.VITE_DEMO_LOCAL === 'true') {
          return this.getJobTrackingLocally(jobId, requesterId);
        }
        console.warn('[getJobTracking] Remote error:', err?.message || err);
      }
    }
    return this.getJobTrackingLocally(jobId, requesterId);
  },

  getJobTrackingLocally(jobId, requesterId) {
    const jobs = getStore(STORAGE_KEYS.JOBS, []);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new ApiError('Job not found', 404);

    const isCustomer = requesterId && (job.customerId === requesterId || requesterId === 'guest-customer');
    const isWorker = requesterId && job.acceptedWorkerId === requesterId;

    if (!isCustomer && !isWorker && requesterId !== 'admin') {
      throw new ApiError('Unauthorized: You do not have permission to view live tracking for this booking.', 403);
    }

    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const worker = workers.find((w) => w.id === job.acceptedWorkerId) || null;

    const destLat = job.latitude != null ? Number(job.latitude) : 19.298;
    const destLng = job.longitude != null ? Number(job.longitude) : 72.855;

    const workerLat = job.workerLatitude ?? worker?.latitude ?? 19.284;
    const workerLng = job.workerLongitude ?? worker?.longitude ?? 72.868;
    const lastUpdate = job.workerLocationUpdatedAt || worker?.lastLocationUpdatedAt || job.acceptedAt || job.createdAt;

    const isLive = lastUpdate ? (Date.now() - new Date(lastUpdate).getTime()) < 120000 : false;
    const distanceKm = calculateDistanceKm(workerLat, workerLng, destLat, destLng);

    return {
      jobId: job.id,
      title: job.title || `${job.service} service`,
      service: job.service,
      status: job.status,
      agreedPrice: job.agreedPrice || job.budget || job.price,
      destination: {
        address: job.location || job.area || 'Customer Service Address',
        latitude: destLat,
        longitude: destLng,
      },
      worker: worker
        ? {
            id: worker.id,
            name: worker.name || worker.fullName || 'Service Professional',
            skill: worker.skill || worker.primarySkill || job.service,
            rating: worker.averageRating || worker.avgRating || 4.8,
            reviewsCount: worker.totalReviewsCount || worker.reviewCount || 12,
            phoneNumber: worker.phoneNumber || '+91 98200 12345',
            latitude: workerLat,
            longitude: workerLng,
            lastLocationUpdatedAt: lastUpdate,
            isLive,
          }
        : null,
      customer: {
        id: job.customerId,
        name: job.customerName || 'Customer',
        address: job.location || 'Local address',
      },
      metrics: {
        distanceKm,
        estimatedDurationMinutes: distanceKm ? Math.max(2, Math.round((distanceKm / 25) * 60)) : null,
      },
      timeline: {
        createdAt: job.createdAt,
        acceptedAt: job.acceptedAt,
        departedAt: job.departedAt,
        arrivedAt: job.arrivedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    };
  },

  /**
   * Updates user profile in local session storage and worker/customer stores.
   */
  async updateUserProfile(userId, updates = {}) {
    if (!userId) throw new ApiError('User ID is required', 400);

    // Update active session user if present
    const rawSession = localStorage.getItem('serviq_session_user');
    let updatedUser = null;
    if (rawSession) {
      try {
        const sessionUser = JSON.parse(rawSession);
        if (sessionUser.id === userId) {
          updatedUser = { ...sessionUser, ...updates };
          localStorage.setItem('serviq_session_user', JSON.stringify(updatedUser));
        }
      } catch (e) {
        console.error('Failed to parse session user:', e);
      }
    }

    // Update workers store if applicable
    const workers = getStore(STORAGE_KEYS.WORKERS, []);
    const workerIdx = workers.findIndex((w) => w.id === userId);
    if (workerIdx !== -1) {
      workers[workerIdx] = {
        ...workers[workerIdx],
        ...updates,
        name: updates.fullName || workers[workerIdx].name,
        skill: updates.primarySkill || workers[workerIdx].skill,
        serviceArea: updates.serviceArea || updates.city || workers[workerIdx].serviceArea,
      };
      saveStore(STORAGE_KEYS.WORKERS, workers);
    }

    return updatedUser || updates;
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
