import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { buildApp } from '../src/app';
import { db } from '../src/database/connection';
import { users } from '../src/database/schema/users';
import { roles, userRoles } from '../src/database/schema/roles';
import { serviceCategories } from '../src/database/schema/categories';
import { customerProfiles } from '../src/database/schema/customer-profiles';
import { addresses } from '../src/database/schema/addresses';
import { workerProfiles } from '../src/database/schema/worker-profiles';
import { workerSkills } from '../src/database/schema/worker-skills';
import { bookings } from '../src/database/schema/bookings';
import { bookingBroadcasts } from '../src/database/schema/booking-broadcasts';
import { negotiationRounds } from '../src/database/schema/negotiations';
import { bookingStatusHistory } from '../src/database/schema/booking-status-history';

describe('Phase 2: Booking Engine, Negotiation & Dispatch Integration Tests', () => {
  let app: FastifyInstance;

  // Test User UUIDs
  const custId = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  const worker1Id = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';
  const worker2Id = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';
  const otherCustId = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1';

  let custToken: string;
  let worker1Token: string;
  let worker2Token: string;
  let otherCustToken: string;

  let plumbingCatId: string;
  let customerAddressId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    custToken = app.jwt.sign({ id: custId, phoneNumber: '+919988770001', roles: ['CUSTOMER'] });
    worker1Token = app.jwt.sign({ id: worker1Id, phoneNumber: '+919988770002', roles: ['WORKER'] });
    worker2Token = app.jwt.sign({ id: worker2Id, phoneNumber: '+919988770003', roles: ['WORKER'] });
    otherCustToken = app.jwt.sign({ id: otherCustId, phoneNumber: '+919988770004', roles: ['CUSTOMER'] });

    const allTestIds = [custId, worker1Id, worker2Id, otherCustId];

    // Cleanup previous test state
    await db.delete(negotiationRounds);
    await db.delete(bookingBroadcasts);
    await db.delete(bookingStatusHistory);
    await db.delete(bookings);
    await db.delete(addresses).where(inArray(addresses.customerId, allTestIds));
    await db.delete(workerSkills).where(inArray(workerSkills.workerId, allTestIds));
    await db.delete(workerProfiles).where(inArray(workerProfiles.id, allTestIds));
    await db.delete(customerProfiles).where(inArray(customerProfiles.id, allTestIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, allTestIds));
    await db.delete(users).where(inArray(users.id, allTestIds));

    // Insert users
    await db.insert(users).values([
      { id: custId, phoneNumber: '+919988770001', status: 'ACTIVE' },
      { id: worker1Id, phoneNumber: '+91988770002', status: 'ACTIVE' },
      { id: worker2Id, phoneNumber: '+919988770003', status: 'ACTIVE' },
      { id: otherCustId, phoneNumber: '+919988770004', status: 'ACTIVE' },
    ]);

    // Customer profile & address
    await db.insert(customerProfiles).values({
      id: custId,
      displayName: 'Aarav Sharma',
    });

    const [addr] = await db.insert(addresses).values({
      customerId: custId,
      addressLabel: 'Home',
      addressLine1: 'B-201, Green Meadows',
      locality: 'Dadar West',
      city: 'Mumbai',
      postalCode: '400028',
      latitude: 19.0178,
      longitude: 72.8478,
      isDefault: true,
    }).returning();
    customerAddressId = addr.id;

    // Get plumbing category
    const cat = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, 'plumbing'),
    });
    plumbingCatId = cat!.id;

    // Worker 1: Bandra West (Verified, Online, Plumber)
    await db.insert(workerProfiles).values({
      id: worker1Id,
      displayName: 'Vikram Plumber',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: true,
      serviceRadiusKm: '15.0',
      latitude: 19.0596,
      longitude: 72.8295,
      completedJobsCount: 10,
    });
    await db.insert(workerSkills).values({
      workerId: worker1Id,
      categoryId: plumbingCatId,
    });

    // Worker 2: Dadar East (Verified, Online, Plumber)
    await db.insert(workerProfiles).values({
      id: worker2Id,
      displayName: 'Anil Plumber',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: true,
      serviceRadiusKm: '10.0',
      latitude: 19.0200,
      longitude: 72.8450,
      completedJobsCount: 5,
    });
    await db.insert(workerSkills).values({
      workerId: worker2Id,
      categoryId: plumbingCatId,
    });
  });

  afterAll(async () => {
    const allTestIds = [custId, worker1Id, worker2Id, otherCustId];
    await db.delete(negotiationRounds);
    await db.delete(bookingBroadcasts);
    await db.delete(bookingStatusHistory);
    await db.delete(bookings);
    await db.delete(addresses).where(inArray(addresses.customerId, allTestIds));
    await db.delete(workerSkills).where(inArray(workerSkills.workerId, allTestIds));
    await db.delete(workerProfiles).where(inArray(workerProfiles.id, allTestIds));
    await db.delete(customerProfiles).where(inArray(customerProfiles.id, allTestIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, allTestIds));
    await db.delete(users).where(inArray(users.id, allTestIds));
    await app.close();
  });

  // ==========================================
  // 1. Direct Booking Lifecycle Tests
  // ==========================================
  describe('Direct Booking Flow', () => {
    let directBookingId: string;

    it('Customer creates a direct booking with a chosen worker', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/direct',
        headers: { authorization: `Bearer ${custToken}` },
        payload: {
          workerId: worker1Id,
          categoryId: plumbingCatId,
          addressId: customerAddressId,
          customerNotes: 'Leaking pipe under kitchen sink',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('PENDING_ACCEPTANCE');
      expect(body.data.dispatchType).toBe('DIRECT');
      expect(body.data.workerId).toBe(worker1Id);
      expect(body.data.serviceAddressText).toContain('Dadar West');
      directBookingId = body.data.id;
    });

    it('Worker accepts direct booking request', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${directBookingId}/respond`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { action: 'ACCEPT' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.status).toBe('ACCEPTED');
      expect(body.data.dispatchedAt).toBeDefined();
    });

    it('Worker transitions status to ARRIVED', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${directBookingId}/status`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { status: 'ARRIVED' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('ARRIVED');
      expect(res.json().data.arrivedAt).toBeDefined();
    });

    it('Unauthorized worker cannot update booking status', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${directBookingId}/status`,
        headers: { authorization: `Bearer ${worker2Token}` }, // Worker 2 is not assigned
        payload: { status: 'IN_PROGRESS' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==========================================
  // 2. Broadcast Dispatch & Concurrency Claim Tests
  // ==========================================
  describe('Broadcast Dispatch & Pessimistic Lock Concurrency Claim', () => {
    let broadcastBookingId: string;

    it('Customer initiates broadcast booking to nearby workers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/broadcast',
        headers: { authorization: `Bearer ${custToken}` },
        payload: {
          categoryId: plumbingCatId,
          addressId: customerAddressId,
          searchRadiusKm: 15,
          customerNotes: 'Urgent bathroom drain overflow',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.status).toBe('BROADCASTING');
      expect(body.data.dispatchType).toBe('BROADCAST');
      expect(body.data.workerId).toBeNull();
      expect(body.data.broadcastRecipientCount).toBeGreaterThanOrEqual(1);
      broadcastBookingId = body.data.id;
    });

    it('Worker 1 sees available broadcast in their feed', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/broadcasts/available',
        headers: { authorization: `Bearer ${worker1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const list = res.json().data;
      const found = list.find((b: any) => b.bookingId === broadcastBookingId);
      expect(found).toBeDefined();
      expect(found.categoryName).toBe('Plumbing');
    });

    it('Worker 1 successfully claims the broadcast booking', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${broadcastBookingId}/claim`,
        headers: { authorization: `Bearer ${worker1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.status).toBe('ACCEPTED');
      expect(body.data.workerId).toBe(worker1Id);
    });

    it('Worker 2 attempts to claim the same booking -> 409 Conflict (Pessimistic Lock Protection)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${broadcastBookingId}/claim`,
        headers: { authorization: `Bearer ${worker2Token}` },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('BOOKING_ALREADY_CLAIMED');
    });
  });

  // ==========================================
  // 3. Negotiation Engine & Bounded Rounds Tests
  // ==========================================
  describe('Negotiation Engine & Bounded Rounds', () => {
    let negoBookingId: string;

    beforeAll(async () => {
      // Create and prepare a booking in ARRIVED state for negotiation
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/direct',
        headers: { authorization: `Bearer ${custToken}` },
        payload: {
          workerId: worker1Id,
          categoryId: plumbingCatId,
          addressId: customerAddressId,
          customerNotes: 'Replace main water valve',
        },
      });
      negoBookingId = res.json().data.id;

      // Worker accepts and arrives
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${negoBookingId}/respond`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { action: 'ACCEPT' },
      });
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${negoBookingId}/status`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { status: 'ARRIVED' },
      });
    });

    it('Worker submits initial estimate (Round 1: ₹600 labor + ₹350 parts)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${negoBookingId}/estimate`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: {
          proposedLaborPrice: 600,
          proposedPartsPrice: 350,
          itemizedLaborDetails: 'Heavy duty brass valve replacement labor (1.5 hours)',
          itemizedPartsDetails: [{ name: 'Brass Valve 1-inch', price: 350, quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.roundNumber).toBe(1);
      expect(body.data.senderRole).toBe('WORKER');
      expect(Number(body.data.proposedLaborPrice)).toBe(600);
      expect(body.data.status).toBe('PENDING');
      expect(body.data.expiresAt).toBeDefined();
    });

    it('Customer counters the initial estimate (Counter-offer: ₹450 labor)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${negoBookingId}/respond`,
        headers: { authorization: `Bearer ${custToken}` },
        payload: {
          action: 'COUNTER',
          counterLaborPrice: 450,
          counterReason: 'Standard valve change usually takes 45 mins',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.action).toBe('COUNTERED');
      expect(body.data.round.senderRole).toBe('CUSTOMER');
      expect(Number(body.data.round.proposedLaborPrice)).toBe(450);
    });

    it('Worker submits counter-offer (Round 2: ₹500 labor + ₹350 parts)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${negoBookingId}/estimate`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: {
          proposedLaborPrice: 500,
          proposedPartsPrice: 350,
          itemizedLaborDetails: 'Compromise rate for complex piping',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.roundNumber).toBe(2);
    });

    it('Worker attempts 3rd estimate -> Rejected by 2-Round Limit Rule (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${negoBookingId}/estimate`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: {
          proposedLaborPrice: 480,
          proposedPartsPrice: 350,
          itemizedLaborDetails: 'Exceeding round limit',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toContain('Maximum negotiation rounds reached');
    });

    it('Customer accepts Round 2 offer -> Booking transitions to IN_PROGRESS with agreed price', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${negoBookingId}/respond`,
        headers: { authorization: `Bearer ${custToken}` },
        payload: { action: 'ACCEPT' },
      });

      expect(res.statusCode).toBe(200);
      const booking = res.json().data.booking;
      expect(booking.status).toBe('IN_PROGRESS');
      expect(Number(booking.agreedLaborPrice)).toBe(500);
      expect(Number(booking.agreedPartsPrice)).toBe(350);
      expect(Number(booking.finalTotalPrice)).toBe(850);
      expect(booking.startedAt).toBeDefined();
    });

    it('Worker completes the job -> Transitions to COMPLETED and increments completedJobsCount', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${negoBookingId}/status`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { status: 'COMPLETED' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('COMPLETED');
      expect(res.json().data.paymentStatus).toBe('PAID');

      // Check worker profile jobs count incremented
      const workerProfile = await db.query.workerProfiles.findFirst({
        where: eq(workerProfiles.id, worker1Id),
      });
      expect(workerProfile!.completedJobsCount).toBeGreaterThanOrEqual(11);
    });
  });

  // ==========================================
  // 4. Cancellation & Trip Fee Policy Tests
  // ==========================================
  describe('Cancellation Policy & Trip Fee Calculations', () => {
    it('Customer cancels during PENDING_ACCEPTANCE -> 100% Free cancellation (₹0 fee)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/direct',
        headers: { authorization: `Bearer ${custToken}` },
        payload: {
          workerId: worker2Id,
          categoryId: plumbingCatId,
          addressId: customerAddressId,
          customerNotes: 'Changed my mind',
        },
      });
      const bId = createRes.json().data.id;

      const cancelRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${bId}/cancel`,
        headers: { authorization: `Bearer ${custToken}` },
        payload: { cancellationReason: 'Booked by mistake' },
      });

      expect(cancelRes.statusCode).toBe(200);
      const data = cancelRes.json().data;
      expect(data.status).toBe('CANCELLED');
      expect(Number(data.cancellationTripFee)).toBe(0);
    });

    it('Customer cancels after worker arrived (Beyond Grace Period) -> Trip Fee ₹100 charged (85% worker share)', async () => {
      // Create and transition booking to ARRIVED with backdated createdAt
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/direct',
        headers: { authorization: `Bearer ${custToken}` },
        payload: {
          workerId: worker2Id,
          categoryId: plumbingCatId,
          addressId: customerAddressId,
        },
      });
      const bId = createRes.json().data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${bId}/respond`,
        headers: { authorization: `Bearer ${worker2Token}` },
        payload: { action: 'ACCEPT' },
      });
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${bId}/status`,
        headers: { authorization: `Bearer ${worker2Token}` },
        payload: { status: 'ARRIVED' },
      });

      // Backdate booking createdAt to 10 minutes ago (beyond 5 min grace period)
      await db.update(bookings).set({
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      }).where(eq(bookings.id, bId));

      const cancelRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/bookings/${bId}/cancel`,
        headers: { authorization: `Bearer ${custToken}` },
        payload: { cancellationReason: 'Customer not at home' },
      });

      expect(cancelRes.statusCode).toBe(200);
      const data = cancelRes.json().data;
      expect(data.status).toBe('CANCELLED');
      expect(Number(data.cancellationTripFee)).toBe(100);
      expect(Number(data.workerCancellationShare)).toBe(85);
      expect(Number(data.platformCancellationFee)).toBe(15);
    });
  });
});
