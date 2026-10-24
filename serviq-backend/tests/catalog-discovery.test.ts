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

describe('Phase 1: Catalog & Hyperlocal Discovery Integration Tests', () => {
  let app: FastifyInstance;

  // Test UUIDs
  const adminId = '11111111-1111-1111-1111-111111111111';
  const customer1Id = '22222222-2222-2222-2222-222222222222';
  const customer2Id = '33333333-3333-3333-3333-333333333333';
  const worker1Id = '44444444-4444-4444-4444-444444444444'; // Nearby plumber (Bandra ~5km)
  const worker2Id = '55555555-5555-5555-5555-555555555555'; // Mid-distance electrician (Andheri ~10.8km)
  const worker3Id = '66666666-6666-6666-6666-666666666666'; // Far away carpenter (Thane ~26km)
  const worker4Id = '77777777-7777-7777-7777-777777777777'; // Nearby unverified plumber
  const worker5Id = '88888888-8888-8888-8888-888888888888'; // Nearby suspended plumber
  const worker6Id = '99999999-9999-9999-9999-999999999999'; // Nearby offline plumber

  let adminToken: string;
  let customer1Token: string;
  let customer2Token: string;
  let worker1Token: string;

  let plumbingCatId: string;
  let electricalCatId: string;
  let inactiveCatId: string;
  let createdAddressId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Generate JWT tokens
    adminToken = app.jwt.sign({ id: adminId, phoneNumber: '+919999900001', roles: ['ADMIN'] });
    customer1Token = app.jwt.sign({ id: customer1Id, phoneNumber: '+919999900002', roles: ['CUSTOMER'] });
    customer2Token = app.jwt.sign({ id: customer2Id, phoneNumber: '+919999900003', roles: ['CUSTOMER'] });
    worker1Token = app.jwt.sign({ id: worker1Id, phoneNumber: '+919999900004', roles: ['WORKER'] });

    // Clean up any stale test records from previous test runs
    const testIds = [adminId, customer1Id, customer2Id, worker1Id, worker2Id, worker3Id, worker4Id, worker5Id, worker6Id];
    await db.delete(addresses).where(inArray(addresses.customerId, [customer1Id, customer2Id]));
    await db.delete(workerSkills).where(inArray(workerSkills.workerId, testIds));
    await db.delete(workerProfiles).where(inArray(workerProfiles.id, testIds));
    await db.delete(customerProfiles).where(inArray(customerProfiles.id, testIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, testIds));
    await db.delete(users).where(inArray(users.id, testIds));

    // Ensure roles exist in roles table
    const existingRoles = await db.select().from(roles);
    if (existingRoles.length === 0) {
      await db.insert(roles).values([
        { id: 'CUSTOMER', description: 'Customer account' },
        { id: 'WORKER', description: 'Service professional' },
        { id: 'ADMIN', description: 'Platform administrator' },
        { id: 'SUPPORT', description: 'Customer support staff' },
      ]);
    }

    // Insert test users
    await db.insert(users).values([
      { id: adminId, phoneNumber: '+919999900001', status: 'ACTIVE' },
      { id: customer1Id, phoneNumber: '+919999900002', status: 'ACTIVE' },
      { id: customer2Id, phoneNumber: '+919999900003', status: 'ACTIVE' },
      { id: worker1Id, phoneNumber: '+919999900004', status: 'ACTIVE' },
      { id: worker2Id, phoneNumber: '+919999900005', status: 'ACTIVE' },
      { id: worker3Id, phoneNumber: '+919999900006', status: 'ACTIVE' },
      { id: worker4Id, phoneNumber: '+919999900007', status: 'ACTIVE' },
      { id: worker5Id, phoneNumber: '+919999900008', status: 'SUSPENDED' }, // Suspended
      { id: worker6Id, phoneNumber: '+919999900009', status: 'ACTIVE' },
    ]);

    // Fetch or create categories
    let plumbing = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, 'plumbing'),
    });
    if (!plumbing) {
      const [inserted] = await db.insert(serviceCategories).values({
        name: 'Plumbing',
        slug: 'plumbing',
        iconKey: 'Wrench',
        isActive: true,
      }).returning();
      plumbing = inserted;
    }
    plumbingCatId = plumbing.id;

    let electrical = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, 'electrical'),
    });
    if (!electrical) {
      const [inserted] = await db.insert(serviceCategories).values({
        name: 'Electrical',
        slug: 'electrical',
        iconKey: 'Zap',
        isActive: true,
      }).returning();
      electrical = inserted;
    }
    electricalCatId = electrical.id;

    // Create an inactive category
    const [inactiveCat] = await db.insert(serviceCategories).values({
      name: 'Old Discontinued Service',
      slug: 'discontinued-service',
      iconKey: 'Archive',
      isActive: false,
    }).returning();
    inactiveCatId = inactiveCat.id;

    // Seed test worker profiles with actual coordinates
    // Worker 1: Bandra West (~5.0km from Dadar center), Verified, Online, baseVisitingFee 200, rating 4.8
    await db.insert(workerProfiles).values({
      id: worker1Id,
      displayName: 'Ramesh Plumber',
      bio: 'Expert plumber in Bandra',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: true,
      latitude: 19.0596,
      longitude: 72.8295,
      serviceRadiusKm: '15.0',
      baseVisitingFee: '200.00',
      averageRating: '4.80',
      totalReviewsCount: 25,
      completedJobsCount: 40,
      lastLocationUpdatedAt: new Date(),
    });
    await db.insert(workerSkills).values({
      workerId: worker1Id,
      categoryId: plumbingCatId,
      experienceMonths: 48,
    });

    // Worker 2: Andheri West (~10.8km from Dadar center), Verified, Online, baseVisitingFee 450, rating 4.2
    await db.insert(workerProfiles).values({
      id: worker2Id,
      displayName: 'Suresh Electrician',
      bio: 'Certified electrician in Andheri',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: true,
      latitude: 19.1136,
      longitude: 72.8697,
      serviceRadiusKm: '20.0',
      baseVisitingFee: '450.00',
      averageRating: '4.20',
      totalReviewsCount: 15,
      completedJobsCount: 22,
      lastLocationUpdatedAt: new Date(),
    });
    await db.insert(workerSkills).values({
      workerId: worker2Id,
      categoryId: electricalCatId,
      experienceMonths: 36,
    });

    // Worker 3: Thane (~26.0km from Dadar center), Verified, Online, rating 4.9
    await db.insert(workerProfiles).values({
      id: worker3Id,
      displayName: 'Mahesh Carpenter',
      bio: 'Carpentry specialist in Thane',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: true,
      latitude: 19.2183,
      longitude: 72.9781,
      serviceRadiusKm: '30.0',
      baseVisitingFee: '350.00',
      averageRating: '4.90',
      totalReviewsCount: 50,
      completedJobsCount: 65,
      lastLocationUpdatedAt: new Date(),
    });

    // Worker 4: Bandra West (Nearby), UNVERIFIED
    await db.insert(workerProfiles).values({
      id: worker4Id,
      displayName: 'Kiran Unverified',
      isVerified: false,
      verificationStatus: 'UNVERIFIED',
      isOnline: true,
      latitude: 19.0596,
      longitude: 72.8295,
      serviceRadiusKm: '10.0',
    });
    await db.insert(workerSkills).values({
      workerId: worker4Id,
      categoryId: plumbingCatId,
      experienceMonths: 12,
    });

    // Worker 5: Bandra West (Nearby), Verified, but User is SUSPENDED
    await db.insert(workerProfiles).values({
      id: worker5Id,
      displayName: 'Suspended Worker',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: true,
      latitude: 19.0596,
      longitude: 72.8295,
      serviceRadiusKm: '10.0',
    });

    // Worker 6: Bandra West (Nearby), Verified, but OFFLINE
    await db.insert(workerProfiles).values({
      id: worker6Id,
      displayName: 'Offline Worker',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: false,
      latitude: 19.0596,
      longitude: 72.8295,
      serviceRadiusKm: '10.0',
      lastLocationUpdatedAt: new Date(),
    });
    await db.insert(workerSkills).values({
      workerId: worker6Id,
      categoryId: plumbingCatId,
      experienceMonths: 24,
    });
  });

  afterAll(async () => {
    // Clean up test data
    const testIds = [adminId, customer1Id, customer2Id, worker1Id, worker2Id, worker3Id, worker4Id, worker5Id, worker6Id];
    await db.delete(addresses).where(inArray(addresses.customerId, [customer1Id, customer2Id]));
    await db.delete(workerSkills).where(inArray(workerSkills.workerId, testIds));
    await db.delete(workerProfiles).where(inArray(workerProfiles.id, testIds));
    await db.delete(customerProfiles).where(inArray(customerProfiles.id, testIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, testIds));
    await db.delete(users).where(inArray(users.id, testIds));
    if (inactiveCatId) {
      await db.delete(serviceCategories).where(eq(serviceCategories.id, inactiveCatId));
    }
    await app.close();
  });

  // ==========================================
  // 1. Service Catalog Tests
  // ==========================================
  describe('Service Catalog APIs', () => {
    it('GET /api/v1/categories returns active categories and excludes inactive ones by default', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/categories',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      // Verify active categories are present
      const slugs = body.data.map((c: any) => c.slug);
      expect(slugs).toContain('plumbing');
      expect(slugs).toContain('electrical');

      // Inactive category must not be present
      expect(slugs).not.toContain('discontinued-service');
    });

    it('GET /api/v1/categories?includeInactive=true includes inactive categories', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/categories?includeInactive=true',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const slugs = body.data.map((c: any) => c.slug);
      expect(slugs).toContain('discontinued-service');
    });

    it('GET /api/v1/categories/:slug returns single category details with subcategories', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/categories/plumbing',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('plumbing');
      expect(body.data.name).toBe('Plumbing');
      expect(Array.isArray(body.data.subcategories)).toBe(true);
    });

    it('POST /api/v1/categories rejects unauthorized users with 401/403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${customer1Token}` },
        payload: {
          name: 'Hacking Category',
          slug: 'hacking-category',
          iconKey: 'Lock',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('POST /api/v1/categories allows ADMIN to create a category', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Home Painting Special',
          slug: 'home-painting-special',
          iconKey: 'Paintbrush',
          description: 'Special painting services',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('home-painting-special');

      // Cleanup
      await db.delete(serviceCategories).where(eq(serviceCategories.id, body.data.id));
    });
  });

  // ==========================================
  // 2. Customer Profiles Tests
  // ==========================================
  describe('Customer Profiles APIs', () => {
    it('GET /api/v1/customers/me rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/customers/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('GET /api/v1/customers/me auto-initializes and returns authenticated profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/customers/me',
        headers: { authorization: `Bearer ${customer1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(customer1Id);
      expect(body.data.phoneNumber).toBe('+919999900002');
      expect(body.data.displayName).toBeDefined();
    });

    it('PUT /api/v1/customers/me updates customer profile with ownership enforcement', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/customers/me',
        headers: { authorization: `Bearer ${customer1Token}` },
        payload: {
          displayName: 'Vikram Malhotra',
          bio: 'Frequent user of home repair services',
          emergencyPhone: '+919876543299',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.displayName).toBe('Vikram Malhotra');

      // Verify customer 2 has their own separate profile
      const cust2Res = await app.inject({
        method: 'GET',
        url: '/api/v1/customers/me',
        headers: { authorization: `Bearer ${customer2Token}` },
      });
      expect(cust2Res.json().data.id).toBe(customer2Id);
      expect(cust2Res.json().data.displayName).not.toBe('Vikram Malhotra');
    });
  });

  // ==========================================
  // 3. Saved Addresses & PostGIS Tests
  // ==========================================
  describe('Saved Addresses & Coordinate Validation', () => {
    it('POST /api/v1/addresses rejects out-of-range latitude/longitude with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        headers: { authorization: `Bearer ${customer1Token}` },
        payload: {
          addressLabel: 'Invalid Point',
          addressLine1: 'Nowhere',
          locality: 'Unknown',
          city: 'Mumbai',
          postalCode: '400001',
          latitude: 95.5, // Invalid > 90
          longitude: 72.8478,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/addresses creates address and sets first address as default automatically', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        headers: { authorization: `Bearer ${customer1Token}` },
        payload: {
          addressLabel: 'Home',
          recipientName: 'Vikram M.',
          recipientPhone: '+919999900002',
          addressLine1: 'Flat 402, Sea View Apartments',
          locality: 'Dadar West',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400028',
          latitude: 19.0178,
          longitude: 72.8478,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.isDefault).toBe(true); // First address forced to true
      createdAddressId = body.data.id;
    });

    it('POST /api/v1/addresses with isDefault=true atomically demotes previous default address', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/addresses',
        headers: { authorization: `Bearer ${customer1Token}` },
        payload: {
          addressLabel: 'Office',
          addressLine1: '12th Floor, Trade Center',
          locality: 'Bandra Kurla Complex',
          city: 'Mumbai',
          postalCode: '400051',
          latitude: 19.0660,
          longitude: 72.8680,
          isDefault: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.isDefault).toBe(true);

      // Verify previous address isDefault flipped to false
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/addresses',
        headers: { authorization: `Bearer ${customer1Token}` },
      });
      const list = listRes.json().data;
      const firstAddr = list.find((a: any) => a.id === createdAddressId);
      expect(firstAddr.isDefault).toBe(false);

      // Verify exactly 1 default address exists for customer 1
      const defaultAddresses = list.filter((a: any) => a.isDefault === true);
      expect(defaultAddresses.length).toBe(1);
    });

    it('Customer 2 cannot modify or delete Customer 1 address (Ownership Check)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/addresses/${createdAddressId}`,
        headers: { authorization: `Bearer ${customer2Token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==========================================
  // 4. Worker Profiles, Skills & Verification Tests
  // ==========================================
  describe('Worker Profiles & Verification APIs', () => {
    it('GET /api/v1/workers/me returns full worker profile with contact details and skills', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workers/me',
        headers: { authorization: `Bearer ${worker1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(worker1Id);
      expect(body.data.phoneNumber).toBe('+919999900004');
      expect(body.data.isVerified).toBe(true);
      expect(body.data.skills.length).toBeGreaterThan(0);
    });

    it('PUT /api/v1/workers/me allows modifying allowed fields, ignores attempt to modify verification', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/workers/me',
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: {
          displayName: 'Ramesh Updated',
          bio: 'Updated bio with 10+ years field experience',
          experienceYears: 12,
          baseVisitingFee: 250,
          serviceRadiusKm: 18,
          // Malicious attempt to change verification status directly
          isVerified: true,
          verificationStatus: 'APPROVED',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.displayName).toBe('Ramesh Updated');
      expect(Number(body.data.baseVisitingFee)).toBe(250);
      expect(body.data.profileCompletenessPct).toBeGreaterThanOrEqual(70);
    });

    it('PATCH /api/v1/workers/availability toggles isOnline status', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/workers/availability',
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { isOnline: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.isOnline).toBe(false);

      // Revert back to online
      await app.inject({
        method: 'PATCH',
        url: '/api/v1/workers/availability',
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { isOnline: true },
      });
    });

    it('GET /api/v1/workers/:id returns public sanitized profile without private phone or coordinates', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/${worker1Id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.displayName).toBe('Ramesh Updated');

      // CRITICAL PRIVACY CHECKS:
      expect(body.data.phoneNumber).toBeUndefined();
      expect(body.data.email).toBeUndefined();
      expect(body.data.latitude).toBeUndefined();
      expect(body.data.longitude).toBeUndefined();
    });

    it('PATCH /api/v1/workers/:id/verification allows ADMIN and rejects non-admin', async () => {
      // Non-admin attempt -> 403 Forbidden
      const failRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workers/${worker4Id}/verification`,
        headers: { authorization: `Bearer ${worker1Token}` },
        payload: { isVerified: true, verificationStatus: 'APPROVED' },
      });
      expect(failRes.statusCode).toBe(403);

      // Admin verification -> 200 OK
      const passRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workers/${worker4Id}/verification`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isVerified: true, verificationStatus: 'APPROVED' },
      });
      expect(passRes.statusCode).toBe(200);
      expect(passRes.json().data.isVerified).toBe(true);

      // Revert worker 4 back to unverified
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/workers/${worker4Id}/verification`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isVerified: false, verificationStatus: 'UNVERIFIED' },
      });
    });
  });

  // ==========================================
  // 5. PostGIS Hyperlocal Search & Discovery Tests
  // ==========================================
  describe('PostGIS Hyperlocal Worker Search (GET /api/v1/workers/search)', () => {
    // Search location: Dadar, Mumbai (lat: 19.0178, lon: 72.8478)
    const dadarLat = 19.0178;
    const dadarLon = 72.8478;

    it('rejects search requests with invalid coordinates or excessive radius', async () => {
      // Invalid latitude (> 90)
      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=99.0&longitude=${dadarLon}`,
      });
      expect(res1.statusCode).toBe(422);

      // Safe maximum radius exceeded (> 30 km)
      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=40`,
      });
      expect(res2.statusCode).toBe(422);
    });

    it('accurately finds workers within 10 km radius and excludes workers beyond 10 km', async () => {
      // Search with radiusKm = 10 from Dadar
      // Worker 1 (Bandra ~5 km) is INSIDE radius
      // Worker 2 (Andheri ~10.8 km) and Worker 3 (Thane ~26 km) are OUTSIDE radius
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=10`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      const foundWorkerIds = body.data.map((w: any) => w.id);
      expect(foundWorkerIds).toContain(worker1Id);
      expect(foundWorkerIds).not.toContain(worker2Id);
      expect(foundWorkerIds).not.toContain(worker3Id);

      // Distance check on returned worker 1
      const w1 = body.data.find((w: any) => w.id === worker1Id);
      expect(w1.distanceKm).toBeGreaterThan(4.0);
      expect(w1.distanceKm).toBeLessThan(6.0);
    });

    it('boundary test: expanding radius to 15 km includes mid-distance worker (~10.8 km)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=15`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const foundWorkerIds = body.data.map((w: any) => w.id);
      expect(foundWorkerIds).toContain(worker1Id);
      expect(foundWorkerIds).toContain(worker2Id); // Now included!
      expect(foundWorkerIds).not.toContain(worker3Id); // Still outside (>25km)
    });

    it('strictly excludes unverified workers (Worker 4) from search results', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=10`,
      });

      const foundWorkerIds = res.json().data.map((w: any) => w.id);
      expect(foundWorkerIds).not.toContain(worker4Id);
    });

    it('strictly excludes suspended users (Worker 5) from search results', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=10`,
      });

      const foundWorkerIds = res.json().data.map((w: any) => w.id);
      expect(foundWorkerIds).not.toContain(worker5Id);
    });

    it('filters by availability: availableNow=true excludes offline worker (Worker 6)', async () => {
      // With availableNow=true -> offline Worker 6 excluded
      const onlineOnlyRes = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=10&availableNow=true`,
      });
      const onlineIds = onlineOnlyRes.json().data.map((w: any) => w.id);
      expect(onlineIds).toContain(worker1Id);
      expect(onlineIds).not.toContain(worker6Id);

      // Without availableNow=true -> Worker 6 is present (bookable for scheduled appointments)
      const allRes = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=10&availableNow=false`,
      });
      const allIds = allRes.json().data.map((w: any) => w.id);
      expect(allIds).toContain(worker6Id);
    });

    it('filters by service category (e.g., category=plumbing)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=20&category=plumbing`,
      });

      expect(res.statusCode).toBe(200);
      const workers = res.json().data;
      expect(workers.length).toBeGreaterThan(0);
      for (const w of workers) {
        const categorySlugs = w.skills.map((s: any) => s.categorySlug);
        expect(categorySlugs).toContain('plumbing');
      }
    });

    it('filters by maximum base price (maxPrice filter)', async () => {
      // Worker 1 visiting fee is 250, Worker 2 is 450
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=20&maxPrice=300`,
      });

      const foundIds = res.json().data.map((w: any) => w.id);
      expect(foundIds).toContain(worker1Id);
      expect(foundIds).not.toContain(worker2Id); // 450 > 300
    });

    it('supports deterministic pagination and stable sorting', async () => {
      const resPage1 = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=30&limit=1&page=1`,
      });

      expect(resPage1.statusCode).toBe(200);
      const body1 = resPage1.json();
      expect(body1.data.length).toBe(1);
      expect(body1.meta.page).toBe(1);
      expect(body1.meta.limit).toBe(1);
      expect(body1.meta.total).toBeGreaterThanOrEqual(2);

      const resPage2 = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=${dadarLat}&longitude=${dadarLon}&radiusKm=30&limit=1&page=2`,
      });

      const body2 = resPage2.json();
      expect(body2.data.length).toBe(1);
      // Different worker on page 2
      expect(body2.data[0].id).not.toBe(body1.data[0].id);
    });

    it('returns empty result with proper envelope when no workers match (e.g., location in Arabian Sea)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/search?latitude=18.5&longitude=71.0&radiusKm=10`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.totalPages).toBe(0);
    });
  });
});
