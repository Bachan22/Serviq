import { describe, it, expect, vi, beforeEach } from 'vitest';
import { negotiationService } from '../src/modules/negotiations/negotiation.service';
import {
  BadRequestError,
  ForbiddenError,
  GoneError,
  NotFoundError,
} from '../src/common/errors/app-error';

// Mock DB
vi.mock('../src/database/connection', () => {
  return {
    db: {
      query: {
        bookings: { findFirst: vi.fn() },
        negotiationRounds: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
      transaction: vi.fn(async (cb) => {
        const mockTx = {
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(() => [{
                  id: 'booking-1',
                  status: 'ACCEPTED',
                  agreedLaborPrice: '325',
                  agreedPartsPrice: '0',
                  finalTotalPrice: '325',
                }]),
              })),
            })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{
                id: 'round-new',
                bookingId: 'booking-1',
                senderRole: 'WORKER',
                roundNumber: 1,
                proposedLaborPrice: '325',
                proposedPartsPrice: '0',
                status: 'PENDING',
              }]),
            })),
          })),
          query: {
            negotiationRounds: { findMany: vi.fn().mockResolvedValue([]) },
          },
        };
        return cb(mockTx);
      }),
    },
    client: { end: vi.fn() },
  };
});

import { db } from '../src/database/connection';

describe('Prompt 4: Two-Way Price Negotiation Unit Tests', () => {
  const customerId = 'c1111111-1111-1111-1111-111111111111';
  const workerId = 'w2222222-2222-2222-2222-222222222222';
  const strangerId = 's3333333-3333-3333-3333-333333333333';
  const bookingId = 'b4444444-4444-4444-4444-444444444444';

  const baseBooking = {
    id: bookingId,
    customerId,
    workerId,
    status: 'NEGOTIATING',
    agreedLaborPrice: null,
    finalTotalPrice: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Flow Step 1-3: Worker receives customer initial offer of ₹300 and counters with ₹325', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({ ...baseBooking });

    // Pending round is from Customer: ₹300
    const customerRound1 = {
      id: 'round-1',
      bookingId,
      senderId: customerId,
      senderRole: 'CUSTOMER',
      roundNumber: 1,
      proposedLaborPrice: '300',
      proposedPartsPrice: '0',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    (db.query.negotiationRounds.findFirst as any).mockResolvedValue(customerRound1);

    const result = await negotiationService.respondToEstimate(workerId, bookingId, {
      action: 'COUNTER',
      counterLaborPrice: 325,
      counterReason: 'Can do for ₹325 with standard warranty',
    });

    expect(result.action).toBe('COUNTERED');
    expect(result.round).toBeDefined();
    expect(result.round.proposedLaborPrice).toBe('325');
  });

  it('Flow Step 4-7: Customer receives worker counter-offer of ₹325 and accepts -> Locks price at ₹325', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({ ...baseBooking });

    // Pending round is from Worker: ₹325
    const workerRound1 = {
      id: 'round-2',
      bookingId,
      senderId: workerId,
      senderRole: 'WORKER',
      roundNumber: 1,
      proposedLaborPrice: '325',
      proposedPartsPrice: '0',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    (db.query.negotiationRounds.findFirst as any).mockResolvedValue(workerRound1);

    const result = await negotiationService.respondToEstimate(customerId, bookingId, {
      action: 'ACCEPT',
    });

    expect(result.action).toBe('ACCEPTED');
    expect(result.booking.status).toBe('ACCEPTED');
    expect(result.booking.agreedLaborPrice).toBe('325');
  });

  it('Security: Prevents third-party stranger from responding to negotiation', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({ ...baseBooking });

    await expect(
      negotiationService.respondToEstimate(strangerId, bookingId, {
        action: 'ACCEPT',
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('Idempotency / Self-Response: Prevents sender from responding to their own offer', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({ ...baseBooking });

    const customerRound1 = {
      id: 'round-1',
      bookingId,
      senderId: customerId,
      senderRole: 'CUSTOMER',
      roundNumber: 1,
      proposedLaborPrice: '300',
      proposedPartsPrice: '0',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    (db.query.negotiationRounds.findFirst as any).mockResolvedValue(customerRound1);

    // Customer tries to accept their own offer
    await expect(
      negotiationService.respondToEstimate(customerId, bookingId, {
        action: 'ACCEPT',
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('Expiry Check: Rejects response if offer has passed 15-minute validity window (410 Gone)', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({ ...baseBooking });

    const expiredRound = {
      id: 'round-1',
      bookingId,
      senderId: customerId,
      senderRole: 'CUSTOMER',
      roundNumber: 1,
      proposedLaborPrice: '300',
      proposedPartsPrice: '0',
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 mins ago
    };

    (db.query.negotiationRounds.findFirst as any).mockResolvedValue(expiredRound);

    await expect(
      negotiationService.respondToEstimate(workerId, bookingId, {
        action: 'ACCEPT',
      })
    ).rejects.toThrow(GoneError);
  });

  it('Locked Price: Prevents subsequent negotiation if booking price is already finalized', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({
      ...baseBooking,
      status: 'IN_PROGRESS',
      agreedLaborPrice: '325',
    });

    await expect(
      negotiationService.respondToEstimate(workerId, bookingId, {
        action: 'COUNTER',
        counterLaborPrice: 400,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('Rejection Flow: Worker rejects customer offer -> Transitions booking to CANCELLED', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({ ...baseBooking });

    const customerRound1 = {
      id: 'round-1',
      bookingId,
      senderId: customerId,
      senderRole: 'CUSTOMER',
      roundNumber: 1,
      proposedLaborPrice: '300',
      proposedPartsPrice: '0',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    (db.query.negotiationRounds.findFirst as any).mockResolvedValue(customerRound1);

    const result = await negotiationService.respondToEstimate(workerId, bookingId, {
      action: 'REJECT',
      counterReason: 'Price too low for this distance',
    });

    expect(result.action).toBe('REJECTED');
    expect(result.message).toContain('Offer rejected');
  });

  it('Round Limits: Prevents party from exceeding max 2 negotiation rounds (400 Bad Request)', async () => {
    (db.query.bookings.findFirst as any).mockResolvedValue({ ...baseBooking });

    const customerRound = {
      id: 'round-3',
      bookingId,
      senderId: customerId,
      senderRole: 'CUSTOMER',
      roundNumber: 2,
      proposedLaborPrice: '310',
      proposedPartsPrice: '0',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    (db.query.negotiationRounds.findFirst as any).mockResolvedValue(customerRound);

    // Mock that worker has already used 2 rounds
    const mockWorkerRounds = [
      { id: 'r1', bookingId, senderRole: 'WORKER', roundNumber: 1 },
      { id: 'r2', bookingId, senderRole: 'WORKER', roundNumber: 2 },
    ];

    vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => {
      const mockTx = {
        update: vi.fn(),
        insert: vi.fn(),
        query: {
          negotiationRounds: { findMany: vi.fn().mockResolvedValue(mockWorkerRounds) },
        },
      };
      return cb(mockTx);
    });

    await expect(
      negotiationService.respondToEstimate(workerId, bookingId, {
        action: 'COUNTER',
        counterLaborPrice: 320,
      })
    ).rejects.toThrow(BadRequestError);
  });
});
