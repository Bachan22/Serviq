import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { buildApp } from '../src/app';
import { db } from '../src/database/connection';
import { users } from '../src/database/schema/users';
import { userRoles } from '../src/database/schema/roles';
import { serviceCategories } from '../src/database/schema/categories';
import { customerProfiles } from '../src/database/schema/customer-profiles';
import { addresses } from '../src/database/schema/addresses';
import { workerProfiles } from '../src/database/schema/worker-profiles';
import { workerSkills } from '../src/database/schema/worker-skills';
import { bookings } from '../src/database/schema/bookings';
import { reviews } from '../src/database/schema/reviews';
import { workerDocuments } from '../src/database/schema/worker-documents';

describe('Phase 4: Reviews, Ratings & Admin Verification Integration Tests', () => {
  let app: FastifyInstance;

  const adminId = 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1';
  const cust1Id = 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
  const cust2Id = 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3';
  const workerId = 'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4';

  let adminToken: string;
  let cust1Token: string;
  let cust2Token: string;
  let workerToken: string;

  let plumbingCatId: string;
  let customerAddressId: string;
  let completedBooking1Id: string;
  let completedBooking2Id: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    adminToken = app.jwt.sign({ id: adminId, phoneNumber: '+919900110001', roles: ['ADMIN'] });
    cust1Token = app.jwt.sign({ id: cust1Id, phoneNumber: '+919900110002', roles: ['CUSTOMER'] });
    cust2Token = app.jwt.sign({ id: cust2Id, phoneNumber: '+919900110003', roles: ['CUSTOMER'] });
    workerToken = app.jwt.sign({ id: workerId, phoneNumber: '+919900110004', roles: ['WORKER'] });

    const allTestIds = [adminId, cust1Id, cust2Id, workerId];

    // Cleanup previous test state
    await db.delete(workerDocuments);
    await db.delete(reviews);
    await db.delete(bookings).where(inArray(bookings.customerId, allTestIds));
    await db.delete(addresses).where(inArray(addresses.customerId, allTestIds));
    await db.delete(workerSkills).where(inArray(workerSkills.workerId, allTestIds));
    await db.delete(workerProfiles).where(inArray(workerProfiles.id, allTestIds));
    await db.delete(customerProfiles).where(inArray(customerProfiles.id, allTestIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, allTestIds));
    await db.delete(users).where(inArray(users.id, allTestIds));

    // Insert users
    await db.insert(users).values([
      { id: adminId, phoneNumber: '+919900110001', status: 'ACTIVE' },
      { id: cust1Id, phoneNumber: '+919900110002', status: 'ACTIVE' },
      { id: cust2Id, phoneNumber: '+919900110003', status: 'ACTIVE' },
      { id: workerId, phoneNumber: '+919900110004', status: 'ACTIVE' },
    ]);

    await db.insert(customerProfiles).values([
      { id: cust1Id, displayName: 'Pooja Nair' },
      { id: cust2Id, displayName: 'Rajesh Iyer' },
    ]);

    const [addr] = await db.insert(addresses).values({
      customerId: cust1Id,
      addressLabel: 'Apartment',
      addressLine1: 'Flat 702, Skyline Towers',
      locality: 'Prabhadevi',
      city: 'Mumbai',
      postalCode: '400025',
      latitude: 19.0150,
      longitude: 72.8250,
      isDefault: true,
    }).returning();
    customerAddressId = addr.id;

    const cat = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, 'plumbing'),
    });
    plumbingCatId = cat!.id;

    // Worker profile initially unverified
    await db.insert(workerProfiles).values({
      id: workerId,
      displayName: 'Karthik Plumber',
      isVerified: false,
      verificationStatus: 'UNVERIFIED',
      isOnline: true,
      serviceRadiusKm: '10.0',
      latitude: 19.0150,
      longitude: 72.8250,
      averageRating: '0.00',
      totalReviewsCount: 0,
      completedJobsCount: 2,
    });

    // Create completed booking 1 for customer 1
    const [b1] = await db.insert(bookings).values({
      bookingNumber: `BK-REV1-${Date.now().toString().slice(-6)}`,
      customerId: cust1Id,
      workerId,
      categoryId: plumbingCatId,
      addressId: customerAddressId,
      serviceAddressText: 'Flat 702, Skyline Towers, Prabhadevi',
      serviceLatitude: 19.0150,
      serviceLongitude: 72.8250,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      finalTotalPrice: '500.00',
    }).returning();
    completedBooking1Id = b1.id;

    // Create completed booking 2 for customer 2
    const [b2] = await db.insert(bookings).values({
      bookingNumber: `BK-REV2-${Date.now().toString().slice(-6)}`,
      customerId: cust2Id,
      workerId,
      categoryId: plumbingCatId,
      addressId: customerAddressId,
      serviceAddressText: 'Flat 702, Skyline Towers, Prabhadevi',
      serviceLatitude: 19.0150,
      serviceLongitude: 72.8250,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      finalTotalPrice: '800.00',
    }).returning();
    completedBooking2Id = b2.id;
  });

  afterAll(async () => {
    const allTestIds = [adminId, cust1Id, cust2Id, workerId];
    await db.delete(workerDocuments);
    await db.delete(reviews);
    await db.delete(bookings).where(inArray(bookings.customerId, allTestIds));
    await db.delete(addresses).where(inArray(addresses.customerId, allTestIds));
    await db.delete(workerSkills).where(inArray(workerSkills.workerId, allTestIds));
    await db.delete(workerProfiles).where(inArray(workerProfiles.id, allTestIds));
    await db.delete(customerProfiles).where(inArray(customerProfiles.id, allTestIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, allTestIds));
    await db.delete(users).where(inArray(users.id, allTestIds));
    await app.close();
  });

  // ==========================================
  // 1. Reviews & Ratings Flow
  // ==========================================
  describe('Reviews & Ratings Engine', () => {
    let createdReviewId: string;

    it('Customer 1 submits 5-star review -> Worker rating becomes 5.00 (Count: 1)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reviews',
        headers: { authorization: `Bearer ${cust1Token}` },
        payload: {
          bookingId: completedBooking1Id,
          rating: 5,
          reviewText: 'Excellent, prompt and neat plumbing work!',
          categoryRatings: { punctuality: 5, quality: 5, behavior: 5 },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.review.rating).toBe(5);
      expect(body.data.updatedWorkerStats.averageRating).toBe(5);
      expect(body.data.updatedWorkerStats.totalReviewsCount).toBe(1);
      createdReviewId = body.data.review.id;
    });

    it('Duplicate review on same booking is rejected with 409 Conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reviews',
        headers: { authorization: `Bearer ${cust1Token}` },
        payload: {
          bookingId: completedBooking1Id,
          rating: 4,
          reviewText: 'Submitting again',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('DUPLICATE_REVIEW');
    });

    it('Customer 2 submits 4-star review -> Average rating updates to 4.50 (Count: 2)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reviews',
        headers: { authorization: `Bearer ${cust2Token}` },
        payload: {
          bookingId: completedBooking2Id,
          rating: 4,
          reviewText: 'Good work, arrived slightly delayed',
          categoryRatings: { punctuality: 3, quality: 5, behavior: 5 },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.updatedWorkerStats.averageRating).toBe(4.5); // (5 + 4) / 2 = 4.50
      expect(body.data.updatedWorkerStats.totalReviewsCount).toBe(2);
    });

    it('Worker replies to Customer 1 review', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${createdReviewId}/reply`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          workerReply: 'Thank you for your valuable feedback, Pooja ji!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.workerReply).toContain('Pooja ji');
      expect(body.data.workerRepliedAt).toBeDefined();
    });

    it('Public: GET /api/v1/workers/:id/reviews lists reviews with customer names', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/${workerId}/reviews`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBe(2);
      expect(body.data[0].customerDisplayName).toBeDefined();
    });
  });

  // ==========================================
  // 2. Worker Document Verification Engine
  // ==========================================
  describe('Worker Identity Verification & Documents Engine', () => {
    let uploadedDocId: string;

    it('Worker uploads Aadhaar verification document -> Status becomes PENDING_REVIEW', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/workers/me/documents',
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          documentType: 'AADHAAR_FRONT',
          documentNumber: 'XXXX-XXXX-1234',
          documentUrl: 'https://storage.serviq.in/docs/aadhaar_front_sample.jpg',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.documentType).toBe('AADHAAR_FRONT');
      expect(body.data.verificationStatus).toBe('PENDING');
      uploadedDocId = body.data.id;

      // Verify worker profile status transitioned to PENDING_REVIEW
      const workerProfile = await db.query.workerProfiles.findFirst({
        where: eq(workerProfiles.id, workerId),
      });
      expect(workerProfile!.verificationStatus).toBe('PENDING_REVIEW');
    });

    it('Non-admin access to admin verification queue is blocked with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/verifications',
        headers: { authorization: `Bearer ${cust1Token}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('Admin views pending verifications queue', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/verifications',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const list = res.json().data;
      expect(list.length).toBeGreaterThanOrEqual(1);
      const item = list.find((d: any) => d.documentId === uploadedDocId);
      expect(item).toBeDefined();
      expect(item.workerDisplayName).toBe('Karthik Plumber');
    });

    it('Admin approves uploaded document', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/verifications/documents/${uploadedDocId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { action: 'APPROVE' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.verificationStatus).toBe('APPROVED');
    });

    it('Admin issues final verification approval for worker profile', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/verifications/workers/${workerId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { action: 'APPROVE' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.isVerified).toBe(true);
      expect(res.json().data.verificationStatus).toBe('APPROVED');
    });
  });

  // ==========================================
  // 3. Admin Platform Metrics & Analytics
  // ==========================================
  describe('Admin Platform Overview & Analytics', () => {
    it('Admin retrieves platform metrics (GMV, bookings, verified workers)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.totalCustomers).toBeGreaterThanOrEqual(2);
      expect(data.totalWorkers).toBeGreaterThanOrEqual(1);
      expect(data.verifiedWorkers).toBeGreaterThanOrEqual(1);
      expect(data.totalBookings).toBeGreaterThanOrEqual(2);
      expect(data.financialOverview).toBeDefined();
    });
  });
});
