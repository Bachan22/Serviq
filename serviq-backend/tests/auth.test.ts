import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { requireRoles } from '../src/common/middlewares/auth.js';

describe('Auth & Session API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    // Register test endpoint protected by WORKER role guard before app.ready()
    app.get('/test/worker-only', { preHandler: [requireRoles(['WORKER'])] }, async () => {
      return { success: true, secret: 'worker_payload' };
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns healthy status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.0.0');
  });

  it('GET /api/v1/config/business-rules returns configurable platform policies', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config/business-rules',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.commissionRatePct).toBeDefined();
    expect(body.data.cancellationTripFee).toBeDefined();
    expect(body.data.maxNegotiationRounds).toBe(2);
    expect(body.data.offerExpiryMinutes).toBe(15);
  });

  it('POST /api/v1/auth/request-otp rejects invalid phone formats', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/request-otp',
      payload: { phoneNumber: 'invalid-phone' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/request-otp succeeds with valid E.164 phone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/request-otp',
      payload: { phoneNumber: '+919876543210' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.expiresInSeconds).toBe(300);
    expect(body.data.devOtp).toBe('123456');
  });

  it('POST /api/v1/auth/verify-otp fails with incorrect code', async () => {
    // Request code first
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/request-otp',
      payload: { phoneNumber: '+919876543211' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      payload: {
        phoneNumber: '+919876543211',
        otp: '999999',
        requestedRole: 'CUSTOMER',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Invalid verification code');
  });

  it('GET /api/v1/auth/me rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  describe('RBAC Middleware Enforcement', () => {
    it('rejects access if no JWT is provided with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test/worker-only',
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects CUSTOMER from accessing WORKER-only route with 403 Forbidden', async () => {
      // Sign a valid customer token
      const customerToken = app.jwt.sign({
        id: 'u-customer-test',
        phoneNumber: '+919876543210',
        roles: ['CUSTOMER'],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/test/worker-only',
        headers: {
          authorization: `Bearer ${customerToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Access denied');
    });

    it('allows WORKER access to WORKER-only route with 200 OK', async () => {
      const workerToken = app.jwt.sign({
        id: 'u-worker-test',
        phoneNumber: '+919876543211',
        roles: ['WORKER'],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/test/worker-only',
        headers: {
          authorization: `Bearer ${workerToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.secret).toBe('worker_payload');
    });
  });
});

