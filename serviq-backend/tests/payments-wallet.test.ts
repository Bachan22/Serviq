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
import { payments } from '../src/database/schema/payments';
import { wallets } from '../src/database/schema/wallets';
import { walletTransactions } from '../src/database/schema/wallet-transactions';
import { payoutRequests } from '../src/database/schema/payout-requests';
import { walletService } from '../src/modules/wallets/wallet.service';

describe('Phase 3: Payments, Wallet & Settlements Integration Tests', () => {
  let app: FastifyInstance;

  const custId = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
  const workerId = 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1';

  let custToken: string;
  let workerToken: string;
  let plumbingCatId: string;
  let customerAddressId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    custToken = app.jwt.sign({ id: custId, phoneNumber: '+919911220001', roles: ['CUSTOMER'] });
    workerToken = app.jwt.sign({ id: workerId, phoneNumber: '+919911220002', roles: ['WORKER'] });

    const allTestIds = [custId, workerId];

    // Cleanup previous test state
    await db.delete(payoutRequests);
    await db.delete(walletTransactions);
    await db.delete(wallets);
    await db.delete(payments);
    await db.delete(bookings);
    await db.delete(addresses).where(inArray(addresses.customerId, allTestIds));
    await db.delete(workerSkills).where(inArray(workerSkills.workerId, allTestIds));
    await db.delete(workerProfiles).where(inArray(workerProfiles.id, allTestIds));
    await db.delete(customerProfiles).where(inArray(customerProfiles.id, allTestIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, allTestIds));
    await db.delete(users).where(inArray(users.id, allTestIds));

    // Insert users
    await db.insert(users).values([
      { id: custId, phoneNumber: '+919911220001', status: 'ACTIVE' },
      { id: workerId, phoneNumber: '+919911220002', status: 'ACTIVE' },
    ]);

    await db.insert(customerProfiles).values({
      id: custId,
      displayName: 'Kavita Reddy',
    });

    const [addr] = await db.insert(addresses).values({
      customerId: custId,
      addressLabel: 'Home',
      addressLine1: 'Villa 14, Palm Grove',
      locality: 'Bandra West',
      city: 'Mumbai',
      postalCode: '400050',
      latitude: 19.0596,
      longitude: 72.8295,
      isDefault: true,
    }).returning();
    customerAddressId = addr.id;

    const cat = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, 'plumbing'),
    });
    plumbingCatId = cat!.id;

    await db.insert(workerProfiles).values({
      id: workerId,
      displayName: 'Sunil Plumber',
      isVerified: true,
      verificationStatus: 'APPROVED',
      isOnline: true,
      serviceRadiusKm: '15.0',
      latitude: 19.0596,
      longitude: 72.8295,
    });
  });

  afterAll(async () => {
    const allTestIds = [custId, workerId];
    await db.delete(payoutRequests);
    await db.delete(walletTransactions);
    await db.delete(wallets);
    await db.delete(payments);
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
  // 1. Worker Wallet Initialization
  // ==========================================
  describe('Worker Wallet Initialization & Credit Limit', () => {
    it('GET /api/v1/wallets/me auto-creates wallet with zero balance and negative credit limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/wallets/me',
        headers: { authorization: `Bearer ${workerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.currentBalance).toBe(0);
      expect(body.data.isFrozen).toBe(false);
      expect(body.data.maxNegativeLimit).toBe(-1500);
      expect(body.data.creditLimitRemaining).toBe(1500);
    });
  });

  // ==========================================
  // 2. Cash On Delivery (COD) & Commission Deduction
  // ==========================================
  describe('Cash On Delivery (COD) Flow & Labor-Only Commission', () => {
    let codBookingId: string;

    beforeAll(async () => {
      // Create a booking in IN_PROGRESS state with agreed labor ₹500 and parts ₹200
      const [booking] = await db.insert(bookings).values({
        bookingNumber: `BK-COD-${Date.now().toString().slice(-6)}`,
        customerId: custId,
        workerId,
        categoryId: plumbingCatId,
        addressId: customerAddressId,
        serviceAddressText: 'Villa 14, Palm Grove, Bandra West',
        serviceLatitude: 19.0596,
        serviceLongitude: 72.8295,
        status: 'IN_PROGRESS',
        agreedLaborPrice: '500.00',
        agreedPartsPrice: '200.00',
        finalTotalPrice: '700.00',
      }).returning();
      codBookingId = booking.id;
    });

    it('Settle COD payment: deducts 10% commission on LABOR ONLY (0% on parts) from worker wallet', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/process',
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          bookingId: codBookingId,
          paymentMethod: 'CASH_ON_DELIVERY',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      const breakdown = body.data.breakdown;
      expect(breakdown.totalAmount).toBe(700);
      expect(breakdown.laborAmount).toBe(500);
      expect(breakdown.partsAmount).toBe(200);
      expect(breakdown.platformCommission).toBe(50); // Exactly 10% of ₹500 labor! (0% on ₹200 parts)
      expect(breakdown.workerPayoutAmount).toBe(650);

      // Verify booking status updated to COMPLETED & PAID
      expect(body.data.booking.status).toBe('COMPLETED');
      expect(body.data.booking.paymentStatus).toBe('PAID');

      // Verify worker wallet was debited by ₹50 (currentBalance is now -₹50)
      const walletRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wallets/me',
        headers: { authorization: `Bearer ${workerToken}` },
      });
      expect(walletRes.json().data.currentBalance).toBe(-50);
      expect(walletRes.json().data.totalCommissionPaid).toBe(50);
      expect(walletRes.json().data.isFrozen).toBe(false); // Still within -1500 limit
    });
  });

  // ==========================================
  // 3. Worker Wallet Top-Up
  // ==========================================
  describe('Worker Wallet Recharge / Top-Up Flow', () => {
    it('Worker recharges wallet with ₹300 -> Balance updates from -₹50 to +₹250', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wallets/me/topup',
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          amount: 300,
          referenceId: 'UPI-TXN-998877',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Number(body.data.wallet.currentBalance)).toBe(250);
      expect(body.data.transaction.transactionType).toBe('WALLET_TOPUP');
    });

    it('GET /api/v1/wallets/me/transactions lists transaction history', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/wallets/me/transactions',
        headers: { authorization: `Bearer ${workerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const list = res.json().data;
      expect(list.length).toBeGreaterThanOrEqual(2);
      const types = list.map((t: any) => t.transactionType);
      expect(types).toContain('COMMISSION_DEDUCTION');
      expect(types).toContain('WALLET_TOPUP');
    });
  });

  // ==========================================
  // 4. Online Payment & Net Payout Flow
  // ==========================================
  describe('Online Payment Flow (UPI/Card) & Net Earnings Credit', () => {
    let onlineBookingId: string;

    beforeAll(async () => {
      const [booking] = await db.insert(bookings).values({
        bookingNumber: `BK-ONL-${Date.now().toString().slice(-6)}`,
        customerId: custId,
        workerId,
        categoryId: plumbingCatId,
        addressId: customerAddressId,
        serviceAddressText: 'Villa 14, Palm Grove, Bandra West',
        serviceLatitude: 19.0596,
        serviceLongitude: 72.8295,
        status: 'IN_PROGRESS',
        agreedLaborPrice: '1000.00',
        agreedPartsPrice: '400.00',
        finalTotalPrice: '1400.00',
      }).returning();
      onlineBookingId = booking.id;
    });

    it('Customer pays online: total ₹1400 -> Platform keeps ₹100, credits worker wallet with ₹1300', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/process',
        headers: { authorization: `Bearer ${custToken}` },
        payload: {
          bookingId: onlineBookingId,
          paymentMethod: 'ONLINE_UPI',
          gatewayPaymentId: 'pay_razor_test_12345',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const breakdown = body.data.breakdown;
      expect(breakdown.totalAmount).toBe(1400);
      expect(breakdown.platformCommission).toBe(100); // 10% of ₹1000
      expect(breakdown.workerPayoutAmount).toBe(1300); // (1000 - 100) + 400

      // Worker balance was ₹250 before; now should be ₹250 + ₹1300 = ₹1550
      const walletRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wallets/me',
        headers: { authorization: `Bearer ${workerToken}` },
      });
      expect(walletRes.json().data.currentBalance).toBe(1550);
      expect(walletRes.json().data.totalEarned).toBe(1300);
    });
  });

  // ==========================================
  // 5. Withdrawal / Payout Request Flow
  // ==========================================
  describe('Worker Payout Withdrawal Flow', () => {
    it('Worker requests payout of ₹500 via UPI -> Balance reduces from ₹1550 to ₹1050', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wallets/me/payouts',
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          amount: 500,
          payoutMethod: 'UPI',
          payoutDetails: {
            upiId: 'sunilplumber@okhdfcbank',
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(Number(body.data.amount)).toBe(500);
      expect(body.data.status).toBe('REQUESTED');

      // Check wallet balance
      const walletRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wallets/me',
        headers: { authorization: `Bearer ${workerToken}` },
      });
      expect(walletRes.json().data.currentBalance).toBe(1050);
    });

    it('Worker attempts payout exceeding available balance -> 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wallets/me/payouts',
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          amount: 5000, // Available balance is 1050
          payoutMethod: 'UPI',
          payoutDetails: {
            upiId: 'sunilplumber@okhdfcbank',
          },
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toContain('Insufficient positive wallet balance');
    });
  });

  // ==========================================
  // 6. Negative Balance Freeze Guard
  // ==========================================
  describe('Negative Balance Freeze Guard', () => {
    it('Wallet freezes (isFrozen=true) if negative balance exceeds -₹1500 limit', async () => {
      // Simulate extreme commission deductions exceeding -1500
      await db.transaction(async (tx) => {
        await walletService.recordCommissionDeduction(tx, workerId, null, 3000);
      });

      const walletRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wallets/me',
        headers: { authorization: `Bearer ${workerToken}` },
      });

      expect(walletRes.json().data.isFrozen).toBe(true);
      expect(walletRes.json().data.currentBalance).toBeLessThan(-1500);
    });
  });
});
