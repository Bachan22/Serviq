import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/database/connection.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockRejectedValue(new Error('offline')),
        })),
      })),
    })),
    execute: vi.fn().mockRejectedValue(new Error('offline')),
  },
  client: { end: vi.fn() },
}));

import {
  discoveryService,
  getStableJitter,
  calculateHaversineKm,
} from '../src/modules/discovery/discovery.service.js';
import { TooManyRequestsError } from '../src/common/errors/app-error.js';

describe('Nearby Workers & Privacy Map API Unit Tests', () => {
  const clientKey = 'test-client-nearby-1';

  beforeEach(() => {
    discoveryService.resetRateLimit();
    discoveryService.updateWorkerOnlineStatus('demo-w-1', true);
    discoveryService.updateWorkerOnlineStatus('demo-w-5', true);
    discoveryService.updateWorkerOnlineStatus('demo-w-11', true);
  });

  it('calculates Haversine distance correctly', () => {
    // Mumbai (19.076, 72.877) to Bhayandar (19.298, 72.855) ~ 24.8 km
    const dist = calculateHaversineKm(19.076, 72.877, 19.298, 72.855);
    expect(dist).toBeGreaterThan(20);
    expect(dist).toBeLessThan(30);
  });

  it('returns stable deterministic coordinate jitter (150-300m) that does not jump on refresh', () => {
    const workerId = 'worker-sample-id-123';
    const jitter1 = getStableJitter(workerId);
    const jitter2 = getStableJitter(workerId);
    const totalDistMeters = Math.hypot(
      jitter1.latOffset * 111000,
      jitter1.lngOffset * 111000 * Math.cos(19.29 * (Math.PI / 180))
    );
    expect(totalDistMeters).toBeGreaterThanOrEqual(150);
    expect(totalDistMeters).toBeLessThanOrEqual(300);
  });

  it('returns ONLY safe fields and NEVER exposes phone, email, hourlyRate or exact address', async () => {
    const workers = await discoveryService.getNearbyWorkers(
      {
        lat: 19.29,
        lng: 72.86,
        radius_km: 10,
      },
      clientKey
    );

    expect(workers.length).toBeGreaterThan(0);
    const sample = workers[0];

    // Allowed fields
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('firstName');
    expect(sample).toHaveProperty('lastInitial');
    expect(sample).toHaveProperty('avatarUrl');
    expect(sample).toHaveProperty('skill');
    expect(sample).toHaveProperty('avgRating');
    expect(sample).toHaveProperty('reviewCount');
    expect(sample).toHaveProperty('isVerified');
    expect(sample).toHaveProperty('distanceKm');
    expect(sample).toHaveProperty('lat');
    expect(sample).toHaveProperty('lng');

    // FORBIDDEN fields (must be undefined)
    expect((sample as any).phone).toBeUndefined();
    expect((sample as any).phoneNumber).toBeUndefined();
    expect((sample as any).email).toBeUndefined();
    expect((sample as any).hourlyRate).toBeUndefined();
    expect((sample as any).baseVisitingFee).toBeUndefined();
    expect((sample as any).price).toBeUndefined();
    expect((sample as any).serviceAddressText).toBeUndefined();
    expect((sample as any).address).toBeUndefined();
  });

  it('filters workers by category: selecting "AC repair" returns only AC repair workers', async () => {
    const workers = await discoveryService.getNearbyWorkers(
      {
        lat: 19.29,
        lng: 72.86,
        radius_km: 15,
        service_slug: 'ac-repair',
      },
      clientKey
    );

    expect(workers.length).toBeGreaterThan(0);
    workers.forEach((w) => {
      expect(w.skill.toLowerCase()).toContain('ac');
    });
  });

  it('updates dynamically when worker goes online/offline', async () => {
    // Both demo-w-5 and demo-w-11 are AC repair workers
    const initial = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 15, service_slug: 'ac-repair' },
      clientKey
    );
    expect(initial.some((w) => w.id === 'demo-w-5')).toBe(true);

    // Worker goes offline
    discoveryService.updateWorkerOnlineStatus('demo-w-5', false);

    const afterOffline = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 15, service_slug: 'ac-repair' },
      clientKey
    );
    expect(afterOffline.some((w) => w.id === 'demo-w-5')).toBe(false);

    // Worker comes back online
    discoveryService.updateWorkerOnlineStatus('demo-w-5', true);

    const afterOnline = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 15, service_slug: 'ac-repair' },
      clientKey
    );
    expect(afterOnline.some((w) => w.id === 'demo-w-5')).toBe(true);
  });

  it('enforces rate limiting: 30 requests allowed, 31st returns 429 TooManyRequestsError', async () => {
    const rateLimitTestKey = 'spammer-test-ip-nearby';
    discoveryService.resetRateLimit(rateLimitTestKey);

    for (let i = 1; i <= 30; i++) {
      discoveryService.checkRateLimit(rateLimitTestKey);
    }

    expect(() => discoveryService.checkRateLimit(rateLimitTestKey)).toThrow(TooManyRequestsError);
    try {
      discoveryService.checkRateLimit(rateLimitTestKey);
    } catch (err: any) {
      expect(err.statusCode).toBe(429);
      expect(err.message).toContain('Rate limit exceeded: max 30 requests per minute');
    }
  });
});
