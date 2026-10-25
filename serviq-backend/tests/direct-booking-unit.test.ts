import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookingService } from '../src/modules/bookings/booking.service';
import { BadRequestError, NotFoundError } from '../src/common/errors/app-error';

// Mock the database connection
vi.mock('../src/database/connection', () => {
  return {
    db: {
      query: {
        addresses: { findFirst: vi.fn() },
        serviceCategories: { findFirst: vi.fn() },
        workerProfiles: { findFirst: vi.fn() },
        users: { findFirst: vi.fn() },
        workerSkills: { findFirst: vi.fn() },
      },
      transaction: vi.fn(async (callback) => {
        const mockTx = {
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{
                id: 'mock-booking-id',
                bookingNumber: 'BK-123456',
                status: 'PENDING_ACCEPTANCE',
                dispatchType: 'DIRECT',
              }]),
            })),
          })),
        };
        return callback(mockTx);
      }),
    },
    client: { end: vi.fn() },
  };
});

import { db } from '../src/database/connection';

describe('Unit Test: createDirectBooking Skill and Status Constraints', () => {
  const customerId = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1';
  const workerId = 'w2w2w2w2-w2w2-w2w2-w2w2-w2w2w2w2w2w2';
  const addressId = 'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3';
  const plumbingCatId = 'cat-plumbing-id';
  const acCatId = 'cat-ac-id';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock customer address
    (db.query.addresses.findFirst as any).mockResolvedValue({
      id: addressId,
      customerId,
      addressLine1: 'Flat 402, Sunshine Heights',
      locality: 'Bhayandar West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '401101',
      latitude: 19.298,
      longitude: 72.855,
    });
  });

  it('PASS: rejects booking when an AC worker is booked for Plumbing', async () => {
    // Plumbing Category
    (db.query.serviceCategories.findFirst as any).mockResolvedValue({
      id: plumbingCatId,
      name: 'Plumbing',
      slug: 'plumbing',
      isActive: true,
    });

    // Worker has skill 'AC repair', no plumbing in secondary skills
    (db.query.workerProfiles.findFirst as any).mockResolvedValue({
      id: workerId,
      displayName: 'Imran Shaikh',
      isVerified: true,
      isOnline: true,
      skill: 'AC repair',
      secondarySkills: ['Electrical'],
    });

    (db.query.users.findFirst as any).mockResolvedValue({
      id: workerId,
      status: 'ACTIVE',
    });

    // Worker does not have plumbing in workerSkills table
    (db.query.workerSkills.findFirst as any).mockResolvedValue(null);

    await expect(
      bookingService.createDirectBooking(customerId, {
        workerId,
        categoryId: plumbingCatId,
        addressId,
        customerNotes: 'Fix tap',
      })
    ).rejects.toThrow(BadRequestError);

    await expect(
      bookingService.createDirectBooking(customerId, {
        workerId,
        categoryId: plumbingCatId,
        addressId,
      })
    ).rejects.toThrow('Selected service professional does not offer Plumbing services.');
  });

  it('PASS: rejects booking when target worker is offline', async () => {
    (db.query.serviceCategories.findFirst as any).mockResolvedValue({
      id: acCatId,
      name: 'AC repair',
      slug: 'ac-repair',
      isActive: true,
    });

    (db.query.workerProfiles.findFirst as any).mockResolvedValue({
      id: workerId,
      displayName: 'Imran Shaikh',
      isVerified: true,
      isOnline: false, // OFFLINE!
      skill: 'AC repair',
    });

    (db.query.users.findFirst as any).mockResolvedValue({
      id: workerId,
      status: 'ACTIVE',
    });

    await expect(
      bookingService.createDirectBooking(customerId, {
        workerId,
        categoryId: acCatId,
        addressId,
      })
    ).rejects.toThrow('Selected service professional is currently offline.');
  });

  it('PASS: rejects booking when target worker is suspended', async () => {
    (db.query.serviceCategories.findFirst as any).mockResolvedValue({
      id: acCatId,
      name: 'AC repair',
      slug: 'ac-repair',
      isActive: true,
    });

    (db.query.workerProfiles.findFirst as any).mockResolvedValue({
      id: workerId,
      displayName: 'Imran Shaikh',
      isVerified: true,
      isOnline: true,
      skill: 'AC repair',
    });

    (db.query.users.findFirst as any).mockResolvedValue({
      id: workerId,
      status: 'SUSPENDED', // SUSPENDED!
    });

    await expect(
      bookingService.createDirectBooking(customerId, {
        workerId,
        categoryId: acCatId,
        addressId,
      })
    ).rejects.toThrow('Selected service professional is currently suspended.');
  });

  it('PASS: accepts booking when target worker has matching skill and is online', async () => {
    (db.query.serviceCategories.findFirst as any).mockResolvedValue({
      id: acCatId,
      name: 'AC repair',
      slug: 'ac-repair',
      isActive: true,
    });

    (db.query.workerProfiles.findFirst as any).mockResolvedValue({
      id: workerId,
      displayName: 'Imran Shaikh',
      isVerified: true,
      isOnline: true,
      skill: 'AC repair',
      secondarySkills: [],
    });

    (db.query.users.findFirst as any).mockResolvedValue({
      id: workerId,
      status: 'ACTIVE',
    });

    (db.query.workerSkills.findFirst as any).mockResolvedValue(null);

    const booking = await bookingService.createDirectBooking(customerId, {
      workerId,
      categoryId: acCatId,
      addressId,
      customerNotes: 'AC not cooling',
    });

    expect(booking).toBeDefined();
    expect(booking.id).toBe('mock-booking-id');
    expect(booking.status).toBe('PENDING_ACCEPTANCE');
  });
});
