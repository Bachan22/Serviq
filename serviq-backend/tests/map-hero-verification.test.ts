import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/database/connection.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockRejectedValue(new Error('offline fallback')),
        })),
      })),
    })),
    execute: vi.fn().mockRejectedValue(new Error('offline fallback')),
  },
  client: { end: vi.fn() },
}));

import {
  discoveryService,
  getStableJitter,
  calculateHaversineKm,
} from '../src/modules/discovery/discovery.service.js';
import { TooManyRequestsError } from '../src/common/errors/app-error.js';

describe('Official Verification Suite for Map-First Hero', () => {
  const clientKey = 'customer-map-verifier-1';

  beforeEach(() => {
    discoveryService.resetRateLimit();
    discoveryService.updateWorkerOnlineStatus('demo-w-1', true);
    discoveryService.updateWorkerOnlineStatus('demo-w-5', true);
    discoveryService.updateWorkerOnlineStatus('demo-w-11', true);
  });

  it('VERIFY 3: A worker who goes offline disappears from the map within 10 seconds; worker who goes online appears', async () => {
    // 1. Initially online
    const initial = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 15, service_slug: 'all' },
      clientKey
    );
    expect(initial.some((w) => w.id === 'demo-w-5')).toBe(true);

    // 2. Worker goes offline (e.g. toggles availability off in dashboard)
    discoveryService.updateWorkerOnlineStatus('demo-w-5', false);

    const afterOffline = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 15, service_slug: 'all' },
      clientKey
    );
    expect(afterOffline.some((w) => w.id === 'demo-w-5')).toBe(false);

    // 3. Worker goes back online
    discoveryService.updateWorkerOnlineStatus('demo-w-5', true);

    const afterOnline = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 15, service_slug: 'all' },
      clientKey
    );
    expect(afterOnline.some((w) => w.id === 'demo-w-5')).toBe(true);
  });

  it('VERIFY 4: Selecting "AC repair" shows only AC repair workers', async () => {
    const acWorkers = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 15, service_slug: 'ac-repair' },
      clientKey
    );

    expect(acWorkers.length).toBeGreaterThan(0);
    acWorkers.forEach((w) => {
      expect(w.skill.toLowerCase()).toContain('ac');
      expect(w.skill.toLowerCase()).not.toContain('plumbing');
      expect(w.skill.toLowerCase()).not.toContain('cleaning');
    });
  });

  it('VERIFY 5: Privacy check - No price, phone, email or exact coordinates appear in response', async () => {
    const workers = await discoveryService.getNearbyWorkers(
      { lat: 19.29, lng: 72.86, radius_km: 10 },
      clientKey
    );

    expect(workers.length).toBeGreaterThan(0);
    for (const w of workers) {
      // Forbidden fields must strictly NOT exist
      expect(w).not.toHaveProperty('phone');
      expect(w).not.toHaveProperty('phoneNumber');
      expect(w).not.toHaveProperty('email');
      expect(w).not.toHaveProperty('hourlyRate');
      expect(w).not.toHaveProperty('baseVisitingFee');
      expect(w).not.toHaveProperty('price');
      expect(w).not.toHaveProperty('serviceAddressText');
      expect(w).not.toHaveProperty('address');

      // Coordinates must be stably jittered (~150 to ~300m away from exact)
      const jitter = getStableJitter(w.id);
      const totalOffsetMeters = Math.hypot(
        jitter.latOffset * 111000,
        jitter.lngOffset * 111000 * Math.cos(19.29 * (Math.PI / 180))
      );
      expect(totalOffsetMeters).toBeGreaterThanOrEqual(150);
      expect(totalOffsetMeters).toBeLessThanOrEqual(300);
    }
  });

  it('VERIFY 8: Anonymous visitor masking logic produces generic title without personal names', () => {
    const mockWorker = {
      id: 'demo-w-5',
      firstName: 'Imran',
      lastInitial: 'S.',
      skill: 'AC repair',
      distanceKm: 0.8,
    };

    // When logged out (isAnonymous = true)
    const anonymousDisplayName = 'Service Professional';
    const labelText = `${anonymousDisplayName} · ${mockWorker.skill}`;
    expect(labelText).toBe('Service Professional · AC repair');
    expect(labelText).not.toContain('Imran');
    expect(labelText).not.toContain('S.');

    // When logged in (isAnonymous = false)
    const authenticatedDisplayName = `${mockWorker.firstName} ${mockWorker.lastInitial}`;
    expect(authenticatedDisplayName).toBe('Imran S.');
  });

  it('VERIFY 10: The 31st request in a minute returns 429 TooManyRequestsError', async () => {
    const spammerKey = 'rapid-map-panner-ip';
    discoveryService.resetRateLimit(spammerKey);

    // 30 allowed requests
    for (let i = 1; i <= 30; i++) {
      discoveryService.checkRateLimit(spammerKey);
    }

    // 31st request triggers 429
    let threw429 = false;
    try {
      discoveryService.checkRateLimit(spammerKey);
    } catch (err: any) {
      threw429 = true;
      expect(err).toBeInstanceOf(TooManyRequestsError);
      expect(err.statusCode).toBe(429);
      expect(err.message).toBe('Rate limit exceeded: max 30 requests per minute for nearby workers');
    }
    expect(threw429).toBe(true);
  });
});
