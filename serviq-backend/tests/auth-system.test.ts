import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';

describe('Complete Role-Separated Auth System Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Role-based Sign Up Flow', () => {
    it('successfully registers a customer account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          role: 'customer',
          fullName: 'Test Customer',
          email: 'new.customer@serviq.test',
          phoneNumber: '+919876543210',
          password: 'Password123!',
          city: 'Bhayandar West, Mumbai',
          acceptTerms: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('customer');
      expect(body.data.user.email).toBe('new.customer@serviq.test');
      expect(body.data.accessToken).toBeDefined();
    });

    it('successfully registers a worker account with primary skill and verification status pending', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          role: 'worker',
          fullName: 'Test Worker',
          email: 'new.worker@serviq.test',
          phoneNumber: '+919876543211',
          password: 'Password123!',
          primarySkill: 'Plumber',
          experienceYears: 4,
          serviceArea: 'Bhayandar & Mira Road',
          hourlyRate: 400,
          acceptTerms: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('worker');
      expect(body.data.user.verificationStatus).toBe('pending');
      expect(body.data.user.primarySkill).toBe('Plumber');
      expect(body.data.user.hourlyRate).toBe(400);
    });

    it('rejects sign up with invalid role (e.g. admin or invalid strings)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          role: 'admin',
          fullName: 'Hacker',
          email: 'admin.hacker@serviq.test',
          phoneNumber: '+919876543212',
          password: 'Password123!',
          acceptTerms: true,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
    });

    it('rejects bot submissions that fill the hidden honeypot field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          role: 'customer',
          fullName: 'Bot User',
          email: 'bot@spam.com',
          phoneNumber: '+919876543213',
          password: 'Password123!',
          acceptTerms: true,
          website: 'http://spam-link.com', // Filled honeypot
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.message).toContain('bot');
    });

    it('rejects common passwords like password123', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          role: 'customer',
          fullName: 'Weak User',
          email: 'weak@serviq.test',
          phoneNumber: '+919876543214',
          password: 'password123',
          acceptTerms: true,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('2. Login & Credential Security', () => {
    it('authenticates customer demo account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'customer.demo@serviq.test',
          password: 'Serviq2026!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('customer');
      expect(body.data.user.fullName).toBe('Gurubachan Singh');
      expect(body.data.accessToken).toBeDefined();
    });

    it('authenticates worker demo account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'worker.demo@serviq.test',
          password: 'Serviq2026!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('worker');
      expect(body.data.user.fullName).toBe('Ramesh Patil');
    });

    it('returns generic error for wrong password without revealing email existence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'customer.demo@serviq.test',
          password: 'WrongPassword!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.message).toBe('Incorrect email or password.');
    });

    it('locks account after 5 failed attempts with remaining countdown', async () => {
      const testEmail = 'lockout.target@serviq.test';
      // Register account first
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          role: 'customer',
          fullName: 'Lockout Target',
          email: testEmail,
          phoneNumber: '+919876543299',
          password: 'CorrectPassword1!',
          acceptTerms: true,
        },
      });

      // Submit 5 wrong attempts
      for (let i = 0; i < 4; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: testEmail, password: 'WrongPassword' },
        });
        expect(res.statusCode).toBe(401);
      }

      // 5th attempt triggers lockout
      const lockRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: testEmail, password: 'WrongPassword' },
      });

      expect(lockRes.statusCode).toBe(429);
      const body = lockRes.json();
      expect(body.error.message).toContain('Account locked');
    });
  });

  describe('3. Password Reset & Neutral Responses', () => {
    it('returns neutral message for forgot-password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: 'customer.demo@serviq.test' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.message).toBe('If this email exists, we have sent a reset link.');
    });

    it('returns the same neutral message for non-existent emails', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: 'nonexistent.user.123@serviq.test' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.message).toBe('If this email exists, we have sent a reset link.');
    });
  });

  describe('4. Auth Events Audit Logging', () => {
    it('GET /api/v1/auth/events records auth events without storing passwords', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/events',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      // Ensure passwords are never present
      body.data.forEach((evt: any) => {
        expect(evt.password).toBeUndefined();
        expect(evt.passwordHash).toBeUndefined();
        expect(evt.eventType).toBeDefined();
        expect(evt.timestamp).toBeDefined();
      });
    });
  });
});
