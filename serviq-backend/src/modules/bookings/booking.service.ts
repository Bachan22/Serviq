import { eq, and, ne, sql, desc, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../database/connection.js';
import { bookings } from '../../database/schema/bookings.js';
import { jobOffers } from '../../database/schema/job-offers.js';
import { negotiationRounds } from '../../database/schema/negotiations.js';
import { bookingBroadcasts } from '../../database/schema/booking-broadcasts.js';
import { bookingStatusHistory } from '../../database/schema/booking-status-history.js';
import { addresses } from '../../database/schema/addresses.js';
import { customerProfiles } from '../../database/schema/customer-profiles.js';
import { workerProfiles } from '../../database/schema/worker-profiles.js';
import { workerSkills } from '../../database/schema/worker-skills.js';
import { serviceCategories } from '../../database/schema/categories.js';
import { users } from '../../database/schema/users.js';
import { wallets } from '../../database/schema/wallets.js';
import { walletTransactions } from '../../database/schema/wallet-transactions.js';
import { notificationService } from '../notifications/notification.service.js';
import { BusinessRules } from '../../config/business-rules.js';
import { env } from '../../config/env.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  GoneError,
} from '../../common/errors/app-error.js';
import {
  CreateDirectBookingInput,
  CreateBroadcastBookingInput,
  ListBookingsQueryInput,
} from './booking.schemas.js';

export function computeStartCode(bookingId: string): string {
  const secret = env.START_CODE_SECRET || 'serviq_start_code_hmac_secret_key_default';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bookingId);
  const digest = hmac.digest();
  const codeNum = digest.readUInt32BE(0) % 10000;
  return String(codeNum).padStart(4, '0');
}

export class BookingService {
  private generateBookingNumber(): string {
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `BK-${Date.now().toString().slice(-6)}-${randomPart}`;
  }

  async resolveCategory(categoryId?: string, serviceName?: string) {
    if (categoryId) {
      const byId = await db.query.serviceCategories.findFirst({
        where: eq(serviceCategories.id, categoryId),
      });
      if (byId) return byId;
    }

    if (serviceName) {
      const norm = serviceName.trim().toLowerCase();
      const all = await db.select().from(serviceCategories);
      const match = all.find(
        (c) => c.name.toLowerCase() === norm || c.slug.toLowerCase() === norm || norm.includes(c.slug.toLowerCase())
      );
      if (match) return match;
    }

    // Default fallback to first active category
    const [first] = await db.select().from(serviceCategories).limit(1);
    return first;
  }

  async resolveAddress(customerId: string, addressId?: string, addressText?: string, lat?: number, lng?: number) {
    // Ensure customer_profiles record exists to prevent FK violations
    const existingProfile = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.id, customerId),
    });
    if (!existingProfile) {
      await db
        .insert(customerProfiles)
        .values({
          id: customerId,
          displayName: 'Customer',
          area: 'Mumbai',
          latitude: lat ?? 19.298,
          longitude: lng ?? 72.855,
        })
        .onConflictDoNothing();
    }

    if (addressId) {
      const addr = await db.query.addresses.findFirst({
        where: and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)),
      });
      if (addr) return addr;
    }

    // Check if customer already has a saved address
    const existing = await db.query.addresses.findFirst({
      where: eq(addresses.customerId, customerId),
    });
    if (existing && !addressText) return existing;

    const fullText = addressText || 'Bhayandar West, Mumbai';
    const latitude = lat ?? 19.298;
    const longitude = lng ?? 72.855;

    const [created] = await db
      .insert(addresses)
      .values({
        customerId,
        addressLabel: 'Service Location',
        addressLine1: fullText,
        locality: 'Bhayandar',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '401101',
        latitude,
        longitude,
        isDefault: !existing,
      })
      .returning();

    return created;
  }

  async createDirectBooking(customerId: string, input: CreateDirectBookingInput) {
    const category = await this.resolveCategory(input.categoryId, input.service);
    if (!category) throw new BadRequestError('Service category could not be resolved.');

    const address = await this.resolveAddress(
      customerId,
      input.addressId,
      input.serviceAddressText || input.address,
      input.latitude,
      input.longitude
    );

    const worker = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, input.workerId),
    });
    const workerUser = await db.query.users.findFirst({
      where: eq(users.id, input.workerId),
    });

    if (!worker || !workerUser) {
      throw new NotFoundError('Selected service professional was not found.');
    }
    if (workerUser.status === 'SUSPENDED') {
      throw new BadRequestError('Selected service professional is currently suspended.');
    }
    if (!worker.isOnline) {
      throw new BadRequestError('Selected service professional is currently offline.');
    }

    const bookingNumber = this.generateBookingNumber();
    const initialPrice = input.initialOfferPrice || input.budget || Number(worker.hourlyRate || worker.baseVisitingFee || 350);
    const isNegotiating = input.pricingMode === 'negotiate' || Boolean(input.initialOfferPrice && input.initialOfferPrice < Number(worker.hourlyRate));
    const initialStatus = isNegotiating ? 'NEGOTIATING' : 'PENDING_ACCEPTANCE';

    return await db.transaction(async (tx) => {
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          bookingNumber,
          customerId,
          workerId: input.workerId,
          categoryId: category.id,
          addressId: address.id,
          title: input.title || `${category.name} direct service`,
          description: input.description || input.details || input.customerNotes || '',
          budget: initialPrice.toString(),
          area: address.addressLine1,
          serviceAddressText: address.addressLine1,
          serviceLatitude: address.latitude,
          serviceLongitude: address.longitude,
          status: initialStatus,
          dispatchType: 'DIRECT',
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
          customerNotes: input.customerNotes,
          agreedLaborPrice: isNegotiating ? null : initialPrice.toString(),
          finalTotalPrice: isNegotiating ? null : initialPrice.toString(),
        })
        .returning();

      // If initial offer made, register offer
      if (isNegotiating) {
        await tx.insert(jobOffers).values({
          jobId: newBooking.id,
          workerId: input.workerId,
          price: initialPrice.toString(),
          kind: 'counter',
          status: 'pending',
        });
      }

      await tx.insert(bookingStatusHistory).values({
        bookingId: newBooking.id,
        toStatus: initialStatus,
        changedBy: customerId,
        changeReason: isNegotiating
          ? `Direct booking with customer offer of ₹${initialPrice}`
          : 'Direct booking created',
      });

      // Notify worker
      await notificationService.createNotification(
        input.workerId,
        'New Direct Booking Request',
        `New request for ${category.name} at ₹${initialPrice}`,
        'JOB_REQUEST',
        newBooking.id
      );

      return newBooking;
    });
  }

  async createBroadcastBooking(customerId: string, input: CreateBroadcastBookingInput) {
    const category = await this.resolveCategory(input.categoryId, input.service || input.category);
    if (!category) throw new BadRequestError('Active service category not found.');

    const address = await this.resolveAddress(
      customerId,
      input.addressId,
      input.serviceAddressText || input.address || input.area,
      input.latitude,
      input.longitude
    );

    const bookingNumber = this.generateBookingNumber();
    const radiusMeters = (input.searchRadiusKm || 10) * 1000;
    const budgetVal = input.budget || 400;

    // Find nearby eligible online workers matching category via PostGIS ST_DWithin
    const nearbyWorkersQuery = sql`
      SELECT w.id
      FROM worker_profiles w
      JOIN users u ON u.id = w.id
      LEFT JOIN worker_skills ws ON ws.worker_id = w.id
      WHERE u.status = 'ACTIVE'
        AND w.is_online = true
        AND (
          ws.category_id = ${category.id}
          OR LOWER(w.skill) = LOWER(${category.name})
          OR LOWER(w.skill) = LOWER(${category.slug})
          OR (w.secondary_skills IS NOT NULL AND w.secondary_skills ? LOWER(${category.name}))
        )
        AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${address.longitude}, ${address.latitude}), 4326)::geography,
          LEAST(${radiusMeters}, (COALESCE(w.service_radius_km, 10) * 1000)::double precision)
        )
      LIMIT 25
    `;

    const nearbyWorkers = await db.execute<{ id: string }>(nearbyWorkersQuery);

    return await db.transaction(async (tx) => {
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          bookingNumber,
          customerId,
          categoryId: category.id,
          addressId: address.id,
          title: input.title || `${category.name} service`,
          description: input.description || input.details || input.customerNotes || '',
          budget: budgetVal.toString(),
          area: address.addressLine1,
          serviceAddressText: address.addressLine1,
          serviceLatitude: address.latitude,
          serviceLongitude: address.longitude,
          status: 'PENDING_ACCEPTANCE',
          dispatchType: 'BROADCAST',
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
          customerNotes: input.customerNotes,
        })
        .returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId: newBooking.id,
        toStatus: 'PENDING_ACCEPTANCE',
        changedBy: customerId,
        changeReason: `Broadcast job posted. Dispatched to ${nearbyWorkers.length} nearby matching workers.`,
      });

      // Insert broadcast entries and send notifications
      for (const w of nearbyWorkers) {
        await tx.insert(bookingBroadcasts).values({
          bookingId: newBooking.id,
          workerId: w.id,
          status: 'SENT',
        });

        await notificationService.createNotification(
          w.id,
          'New Job Request Nearby',
          `New ${category.name} job in ${address.locality || 'your area'}. Budget: ₹${budgetVal}`,
          'JOB_REQUEST',
          newBooking.id
        );
      }

      return {
        ...newBooking,
        broadcastRecipientCount: nearbyWorkers.length,
      };
    });
  }

  // ================= OFFERS AND LIVE NEGOTIATION =================

  async createOffer(workerId: string, bookingId: string, price: number, kind: 'accept' | 'counter') {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking request not found.');
    if (!['PENDING_ACCEPTANCE', 'open', 'bidding', 'NEGOTIATING', 'BROADCASTING'].includes(booking.status)) {
      throw new BadRequestError(`Cannot submit offer for job in ${booking.status} status.`);
    }

    const worker = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, workerId),
    });
    if (!worker || !worker.isOnline) {
      throw new BadRequestError('You must be online to submit offers on service requests.');
    }

    // Demote any existing pending offer from this worker on this booking
    await db
      .update(jobOffers)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(and(eq(jobOffers.jobId, bookingId), eq(jobOffers.workerId, workerId), eq(jobOffers.status, 'pending')));

    const [offer] = await db
      .insert(jobOffers)
      .values({
        jobId: bookingId,
        workerId,
        price: price.toString(),
        kind,
        status: 'pending',
      })
      .returning();

    // Transition booking status to bidding
    await db
      .update(bookings)
      .set({ status: 'bidding', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));

    // Notify customer
    await notificationService.createNotification(
      booking.customerId,
      'New Offer on Your Job',
      `${worker.displayName} ${kind === 'accept' ? 'accepted your budget at' : 'countered with'} ₹${price}`,
      'NEW_OFFER',
      bookingId
    );

    return offer;
  }

  async getJobOffers(userId: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
    if (!booking) throw new NotFoundError('Booking not found.');

    const offersList = await db
      .select({
        offerId: jobOffers.id,
        price: jobOffers.price,
        kind: jobOffers.kind,
        status: jobOffers.status,
        createdAt: jobOffers.createdAt,
        workerId: workerProfiles.id,
        displayName: workerProfiles.displayName,
        skill: workerProfiles.skill,
        averageRating: workerProfiles.averageRating,
        totalReviewsCount: workerProfiles.totalReviewsCount,
        isVerified: workerProfiles.isVerified,
        workerLat: workerProfiles.latitude,
        workerLng: workerProfiles.longitude,
      })
      .from(jobOffers)
      .innerJoin(workerProfiles, eq(jobOffers.workerId, workerProfiles.id))
      .where(eq(jobOffers.jobId, bookingId))
      .orderBy(desc(jobOffers.createdAt));

    const now = Date.now();
    const expiryMs = 15 * 60 * 1000; // 15 mins

    return offersList.map((o) => {
      const createdTime = new Date(o.createdAt).getTime();
      const isExpired = o.status === 'pending' && now - createdTime > expiryMs;

      // Distance calculation (Haversine)
      let distanceKm = null;
      if (booking.serviceLatitude && booking.serviceLongitude && o.workerLat && o.workerLng) {
        const R = 6371;
        const dLat = ((booking.serviceLatitude - o.workerLat) * Math.PI) / 180;
        const dLon = ((booking.serviceLongitude - o.workerLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((o.workerLat * Math.PI) / 180) *
            Math.cos((booking.serviceLatitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(R * c * 10) / 10;
      }

      const nameParts = (o.displayName || 'Service Partner').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Service';
      const lastInitial = nameParts.length > 1 ? `${nameParts[nameParts.length - 1][0].toUpperCase()}.` : '';

      return {
        id: o.offerId,
        workerId: o.workerId,
        displayName: o.displayName,
        firstName,
        lastInitial,
        skill: o.skill || 'Technician',
        rating: o.averageRating ? Number(o.averageRating) : null,
        reviewCount: o.totalReviewsCount,
        isVerified: Boolean(o.isVerified),
        distanceKm,
        price: Number(o.price),
        kind: o.kind,
        status: isExpired ? 'expired' : o.status,
        createdAt: o.createdAt,
        expiresAt: new Date(createdTime + expiryMs).toISOString(),
        isExpired: Boolean(isExpired),
      };
    });
  }

  async acceptJobOffer(customerId: string, bookingId: string, offerId: string) {
    const result = await db.transaction(async (tx) => {
      // 1. Pessimistic lock row FOR UPDATE
      const lockQuery = sql`
        SELECT *
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE
      `;
      const lockRes = await tx.execute<any>(lockQuery);
      const booking = lockRes[0];

      if (!booking) throw new NotFoundError('Booking not found.');
      if (booking.customer_id !== customerId) {
        throw new ForbiddenError('You are not authorized to accept offers on this job.');
      }

      if (['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)) {
        throw new ConflictError('This job was already accepted or booked by another professional.', 'JOB_ALREADY_TAKEN');
      }

      const offer = await tx.query.jobOffers.findFirst({
        where: and(eq(jobOffers.id, offerId), eq(jobOffers.jobId, bookingId)),
      });

      if (!offer) throw new NotFoundError('Offer not found.');

      // Expiry check (15 minutes)
      const now = Date.now();
      const createdTime = new Date(offer.createdAt).getTime();
      if (now - createdTime > 15 * 60 * 1000) {
        await tx.update(jobOffers).set({ status: 'expired' }).where(eq(jobOffers.id, offerId));
        throw new GoneError('This offer has expired.');
      }

      // 2. Assign winning worker & transition booking to ACCEPTED
      const [updatedBooking] = await tx
        .update(bookings)
        .set({
          workerId: offer.workerId,
          agreedLaborPrice: offer.price,
          finalTotalPrice: offer.price,
          status: 'ACCEPTED',
          dispatchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      // 3. Mark winning offer accepted, and all other offers rejected
      await tx.update(jobOffers).set({ status: 'accepted', updatedAt: new Date() }).where(eq(jobOffers.id, offerId));
      await tx
        .update(jobOffers)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(and(eq(jobOffers.jobId, bookingId), ne(jobOffers.id, offerId)));

      // 4. Expire all broadcast tickets
      await tx.update(bookingBroadcasts).set({ status: 'EXPIRED' }).where(eq(bookingBroadcasts.bookingId, bookingId));

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: booking.status,
        toStatus: 'ACCEPTED',
        changedBy: customerId,
        changeReason: `Customer accepted offer of ₹${offer.price} from worker`,
      });

      return { updatedBooking, workerId: offer.workerId, price: offer.price };
    });

    // 5. Notify winner asynchronously after transaction commits cleanly
    try {
      await notificationService.createNotification(
        result.workerId,
        'Offer Accepted!',
        `Customer accepted your offer of ₹${result.price}! Start moving when ready.`,
        'OFFER_ACCEPTED',
        bookingId
      );
    } catch (notifErr) {
      console.warn('[acceptJobOffer] Notification dispatch failed:', notifErr);
    }

    return result.updatedBooking;
  }

  async rejectJobOffer(customerId: string, bookingId: string, offerId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.customerId !== customerId) throw new ForbiddenError('Unauthorized.');

    const [rejected] = await db
      .update(jobOffers)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.jobId, bookingId)))
      .returning();

    return rejected;
  }

  async customerCounterOffer(customerId: string, bookingId: string, offerId: string, counterPrice: number) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.customerId !== customerId) throw new ForbiddenError('Unauthorized.');

    const targetOffer = await db.query.jobOffers.findFirst({
      where: and(eq(jobOffers.id, offerId), eq(jobOffers.jobId, bookingId)),
    });
    if (!targetOffer) throw new NotFoundError('Offer not found.');

    // Demote previous offer to countered
    await db.update(jobOffers).set({ status: 'countered', updatedAt: new Date() }).where(eq(jobOffers.id, offerId));

    // Insert new counter offer from customer
    const [counter] = await db
      .insert(jobOffers)
      .values({
        jobId: bookingId,
        workerId: targetOffer.workerId,
        price: counterPrice.toString(),
        kind: 'counter',
        status: 'pending',
      })
      .returning();

    await notificationService.createNotification(
      targetOffer.workerId,
      'Customer Counter-Offer Received',
      `Customer countered with ₹${counterPrice} on your offer`,
      'COUNTER_RECEIVED',
      bookingId
    );

    return counter;
  }

  // ================= LIFECYCLE & STATUS CHANGES =================

  async updateBookingStatus(workerId: string, bookingId: string, requestedStatus: string, startCode?: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.workerId !== workerId) throw new ForbiddenError('You are not assigned to this booking.');

    const newStatus = requestedStatus.toUpperCase();
    const currentStatus = booking.status.toUpperCase();

    const validTransitions: Record<string, string[]> = {
      PENDING_ACCEPTANCE: ['ACCEPTED', 'CANCELLED'],
      NEGOTIATING: ['ACCEPTED', 'CANCELLED'],
      BROADCASTING: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['ON_THE_WAY', 'ARRIVED', 'CANCELLED'],
      ON_THE_WAY: ['ARRIVED', 'CANCELLED'],
      ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['PAYMENT_PENDING'],
      PAYMENT_PENDING: ['COMPLETED'],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestError(`Invalid transition from ${currentStatus} to ${newStatus}.`);
    }

    // Phase B: Start code check for transition to IN_PROGRESS
    if (newStatus === 'IN_PROGRESS') {
      const now = new Date();
      if (booking.startCodeLockedUntil && new Date(booking.startCodeLockedUntil) > now) {
        const remainingSeconds = Math.ceil((new Date(booking.startCodeLockedUntil).getTime() - now.getTime()) / 1000);
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        throw new BadRequestError(
          `Start verification is locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`
        );
      }

      if (!startCode || startCode.length !== 4) {
        throw new BadRequestError('4-digit start verification code from customer is required to begin work.');
      }

      const expectedCode = computeStartCode(booking.id);
      const codeMatches =
        startCode.length === 4 &&
        crypto.timingSafeEqual(Buffer.from(startCode), Buffer.from(expectedCode));

      if (!codeMatches) {
        const newAttempts = (booking.startCodeAttempts || 0) + 1;
        if (newAttempts >= 5) {
          const lockTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minute lockout
          await db
            .update(bookings)
            .set({ startCodeAttempts: 0, startCodeLockedUntil: lockTime, updatedAt: new Date() })
            .where(eq(bookings.id, bookingId));

          throw new BadRequestError('Invalid 4-digit code. Verification locked for 10 minutes.');
        } else {
          await db
            .update(bookings)
            .set({ startCodeAttempts: newAttempts, updatedAt: new Date() })
            .where(eq(bookings.id, bookingId));

          throw new BadRequestError(`Invalid 4-digit start code. ${5 - newAttempts} attempt(s) remaining.`);
        }
      }

      // Code matched! Clear attempts
      await db
        .update(bookings)
        .set({ startCodeAttempts: 0, startCodeLockedUntil: null })
        .where(eq(bookings.id, bookingId));
    }

    const updated = await db.transaction(async (tx) => {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === 'ON_THE_WAY') updateData.onTheWayAt = new Date();
      if (newStatus === 'ARRIVED') updateData.arrivedAt = new Date();
      if (newStatus === 'IN_PROGRESS') updateData.startedAt = new Date();
      if (newStatus === 'PAYMENT_PENDING') updateData.completedAt = new Date();

      const [updated] = await tx
        .update(bookings)
        .set(updateData)
        .where(eq(bookings.id, bookingId))
        .returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: currentStatus,
        toStatus: newStatus,
        changedBy: workerId,
        changeReason: `Status transitioned to ${newStatus}`,
      });

      return updated;
    });

    // Send customer notification after transaction commits
    try {
      if (newStatus === 'ON_THE_WAY') {
        await notificationService.createNotification(
          booking.customerId,
          'Professional is On The Way',
          'Your service professional is heading to your location.',
          'ON_THE_WAY',
          bookingId
        );
      } else if (newStatus === 'ARRIVED') {
        await notificationService.createNotification(
          booking.customerId,
          'Professional Arrived',
          'Your professional has arrived at your doorstep. Share your 4-digit start code.',
          'ARRIVED',
          bookingId
        );
      } else if (newStatus === 'IN_PROGRESS') {
        await notificationService.createNotification(
          booking.customerId,
          'Work in Progress',
          'Service has officially started.',
          'JOB_STARTED',
          bookingId
        );
      } else if (newStatus === 'PAYMENT_PENDING') {
        await notificationService.createNotification(
          booking.customerId,
          'Work Completed - Confirm Payment',
          'Professional has completed the job. Please confirm to finalize payment.',
          'PAYMENT_PENDING',
          bookingId
        );
      }
    } catch (notifErr) {
      console.warn('[updateBookingStatus] Notification error:', notifErr);
    }

    return updated;
  }

  /**
   * Phase B: Customer confirms completion, setting status to COMPLETED and crediting worker
   */
  async confirmCompletion(customerId: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.customerId !== customerId) throw new ForbiddenError('Unauthorized.');

    if (booking.status.toUpperCase() !== 'PAYMENT_PENDING') {
      throw new BadRequestError(`Cannot confirm completion when job is in ${booking.status} status.`);
    }

    return await db.transaction(async (tx) => {
      const [completedBooking] = await tx
        .update(bookings)
        .set({
          status: 'COMPLETED',
          customerConfirmedAt: new Date(),
          paymentStatus: 'PAID',
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: 'PAYMENT_PENDING',
        toStatus: 'COMPLETED',
        changedBy: customerId,
        changeReason: 'Customer confirmed job completion. Payment processed (Simulated payment).',
      });

      // Update worker completed jobs count
      if (booking.workerId) {
        await tx
          .update(workerProfiles)
          .set({ completedJobsCount: sql`${workerProfiles.completedJobsCount} + 1` })
          .where(eq(workerProfiles.id, booking.workerId));

        // Payout to worker wallet (Simulated payment)
        const totalAmount = Number(booking.finalTotalPrice || booking.agreedLaborPrice || booking.budget || 400);
        const payoutAmount = Math.round(totalAmount * 0.9); // 10% platform share

        // Ensure wallet exists
        let workerWallet = await tx.query.wallets.findFirst({
          where: eq(wallets.workerId, booking.workerId),
        });

        if (!workerWallet) {
          const [w] = await tx
            .insert(wallets)
            .values({
              workerId: booking.workerId,
              currentBalance: payoutAmount.toString(),
              totalEarned: payoutAmount.toString(),
            })
            .returning();
          workerWallet = w;
        } else {
          await tx
            .update(wallets)
            .set({
              currentBalance: sql`${wallets.currentBalance} + ${payoutAmount}`,
              totalEarned: sql`${wallets.totalEarned} + ${payoutAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(wallets.workerId, booking.workerId));
        }

        // Ledger entry
        await tx.insert(walletTransactions).values({
          walletId: workerWallet.id,
          bookingId: booking.id,
          transactionType: 'EARNING_CREDIT',
          amount: payoutAmount.toString(),
          balanceBefore: workerWallet.currentBalance,
          balanceAfter: (Number(workerWallet.currentBalance) + payoutAmount).toString(),
          description: `Simulated payment for ${booking.title || 'Completed Job'} (#${booking.bookingNumber})`,
        });

        await notificationService.createNotification(
          booking.workerId,
          'Job Confirmed & Paid',
          `Customer confirmed completion. ₹${payoutAmount} credited to your earnings (Simulated payment).`,
          'JOB_COMPLETED',
          bookingId
        );
      }

      return completedBooking;
    });
  }

  async cancelBooking(userId: string, role: string, bookingId: string, reason: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking not found.');

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerId === userId;
    const isAdmin = role.includes('ADMIN');

    if (!isCustomer && !isWorker && !isAdmin) {
      throw new ForbiddenError('You are not authorized to cancel this booking.');
    }

    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      throw new BadRequestError(`Cannot cancel a booking that is already ${booking.status}.`);
    }

    return await db.transaction(async (tx) => {
      const [cancelled] = await tx
        .update(bookings)
        .set({
          status: 'CANCELLED',
          cancelledBy: isCustomer ? 'CUSTOMER' : isWorker ? 'WORKER' : 'ADMIN',
          cancellationReason: reason,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: booking.status,
        toStatus: 'CANCELLED',
        changedBy: userId,
        changeReason: `Booking cancelled: ${reason}`,
      });

      return cancelled;
    });
  }

  async getBookingDetails(userId: string, role: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking not found.');

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerId === userId;
    const isAdmin = role.includes('ADMIN');

    if (!isCustomer && !isWorker && !isAdmin && booking.dispatchType !== 'BROADCAST') {
      throw new ForbiddenError('Unauthorized: You do not have access to this booking.');
    }

    const customer = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.id, booking.customerId),
    });

    const worker = booking.workerId
      ? await db.query.workerProfiles.findFirst({
          where: eq(workerProfiles.id, booking.workerId),
        })
      : null;

    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, booking.categoryId),
    });

    const history = await db.query.bookingStatusHistory.findMany({
      where: eq(bookingStatusHistory.bookingId, bookingId),
      orderBy: [desc(bookingStatusHistory.createdAt)],
    });

    // Start code is ONLY visible to the customer! Worker never receives startCode!
    const startCode = isCustomer ? computeStartCode(booking.id) : undefined;

    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      title: booking.title,
      description: booking.description,
      status: booking.status,
      dispatchType: booking.dispatchType,
      budget: booking.budget ? Number(booking.budget) : null,
      scheduledFor: booking.scheduledFor,
      customerNotes: booking.customerNotes,
      serviceAddress: {
        fullText: booking.serviceAddressText,
        latitude: booking.serviceLatitude,
        longitude: booking.serviceLongitude,
      },
      pricing: {
        agreedLaborPrice: booking.agreedLaborPrice ? Number(booking.agreedLaborPrice) : null,
        finalTotalPrice: booking.finalTotalPrice ? Number(booking.finalTotalPrice) : null,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        isSimulatedPayment: true,
      },
      customer: {
        id: booking.customerId,
        displayName: customer?.displayName || 'Customer',
      },
      worker: worker
        ? {
            id: worker.id,
            displayName: worker.displayName,
            skill: worker.skill,
            averageRating: worker.averageRating ? Number(worker.averageRating) : null,
            totalReviewsCount: worker.totalReviewsCount,
          }
        : null,
      category: category
        ? {
            id: category.id,
            name: category.name,
            slug: category.slug,
          }
        : null,
      startCode,
      startCodeLockedUntil: booking.startCodeLockedUntil,
      customerConfirmedAt: booking.customerConfirmedAt,
      timeline: {
        createdAt: booking.createdAt,
        dispatchedAt: booking.dispatchedAt,
        onTheWayAt: booking.onTheWayAt,
        arrivedAt: booking.arrivedAt,
        startedAt: booking.startedAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
      },
      history,
    };
  }

  async listBookings(userId: string, role: string, query: ListBookingsQueryInput) {
    const { status, page, limit } = query;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (role === 'CUSTOMER') {
      conditions.push(eq(bookings.customerId, userId));
    } else if (role === 'WORKER') {
      conditions.push(eq(bookings.workerId, userId));
    }

    if (status) {
      conditions.push(eq(bookings.status, status));
    }

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const list = await db.query.bookings.findMany({
      where,
      orderBy: [desc(bookings.createdAt)],
      limit,
      offset,
    });

    const [countResult] = await db.select({ count: sql`COUNT(*)::int` }).from(bookings).where(where);
    const total = Number(countResult?.count || 0);

    // Format list with startCode for customer
    const formatted = list.map((b) => ({
      ...b,
      price: Number(b.finalTotalPrice || b.agreedLaborPrice || b.budget || 400),
      budget: Number(b.budget || 400),
      startCode: role === 'CUSTOMER' ? computeStartCode(b.id) : undefined,
    }));

    return {
      bookings: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAvailableBroadcasts(workerId: string) {
    // Return all eligible requests matching worker via SQL matching function
    const list = await db.execute<any>(sql`
      SELECT * FROM get_matching_jobs(${workerId}::uuid);
    `);
    return list;
  }

  async claimBroadcastBooking(workerId: string, bookingId: string) {
    return await db.transaction(async (tx) => {
      const lockQuery = sql`
        SELECT *
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE
      `;
      const lockResult = await tx.execute<any>(lockQuery);
      const booking = lockResult[0];

      if (!booking) throw new NotFoundError('Booking request not found.');

      if (booking.worker_id !== null || !['PENDING_ACCEPTANCE', 'open', 'bidding', 'BROADCASTING'].includes(booking.status)) {
        throw new ConflictError('This service request has already been claimed or taken.', 'BOOKING_ALREADY_CLAIMED');
      }

      const [updated] = await tx
        .update(bookings)
        .set({
          workerId,
          status: 'ACCEPTED',
          agreedLaborPrice: booking.budget,
          finalTotalPrice: booking.budget,
          dispatchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: booking.status,
        toStatus: 'ACCEPTED',
        changedBy: workerId,
        changeReason: 'Claimed by professional',
      });

      await notificationService.createNotification(
        booking.customer_id,
        'Booking Accepted',
        'A matching professional accepted your service request.',
        'OFFER_ACCEPTED',
        bookingId
      );

      return updated;
    });
  }

  async workerRespondDirect(workerId: string, bookingId: string, action: 'ACCEPT' | 'DECLINE', reason?: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.workerId !== workerId) throw new ForbiddenError('Unauthorized.');

    return await db.transaction(async (tx) => {
      if (action === 'ACCEPT') {
        const [updated] = await tx
          .update(bookings)
          .set({
            status: 'ACCEPTED',
            dispatchedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId))
          .returning();

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: booking.status,
          toStatus: 'ACCEPTED',
          changedBy: workerId,
          changeReason: 'Direct booking accepted by professional',
        });

        await notificationService.createNotification(
          booking.customerId,
          'Direct Booking Accepted',
          'Professional has accepted your booking.',
          'OFFER_ACCEPTED',
          bookingId
        );

        return updated;
      } else {
        const [updated] = await tx
          .update(bookings)
          .set({
            status: 'CANCELLED',
            cancelledBy: 'WORKER',
            cancellationReason: reason || 'Declined by professional',
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId))
          .returning();

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: booking.status,
          toStatus: 'CANCELLED',
          changedBy: workerId,
          changeReason: reason || 'Declined by professional',
        });

        await notificationService.createNotification(
          booking.customerId,
          'Direct Booking Declined',
          'Professional was unavailable and declined the request.',
          'BOOKING_DECLINED',
          bookingId
        );

        return updated;
      }
    });
  }

  async getBookingTracking(userId: string, role: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking not found.');

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerId === userId;
    const isAdmin = role.includes('ADMIN');

    if (!isCustomer && !isWorker && !isAdmin) {
      throw new ForbiddenError('Unauthorized: You cannot access live tracking for this booking.');
    }

    const worker = booking.workerId
      ? await db.query.workerProfiles.findFirst({
          where: eq(workerProfiles.id, booking.workerId),
        })
      : null;

    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, booking.categoryId),
    });

    const startCode = isCustomer ? computeStartCode(booking.id) : undefined;

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      categoryName: category?.name,
      destination: {
        address: booking.serviceAddressText,
        latitude: booking.serviceLatitude,
        longitude: booking.serviceLongitude,
      },
      worker: worker
        ? {
            id: worker.id,
            displayName: worker.displayName,
            averageRating: Number(worker.averageRating),
            totalReviewsCount: worker.totalReviewsCount,
            latitude: worker.latitude,
            longitude: worker.longitude,
            lastLocationUpdatedAt: worker.lastLocationUpdatedAt,
          }
        : null,
      startCode,
      startCodeLockedUntil: booking.startCodeLockedUntil,
      customerConfirmedAt: booking.customerConfirmedAt,
      timeline: {
        createdAt: booking.createdAt,
        dispatchedAt: booking.dispatchedAt,
        onTheWayAt: booking.onTheWayAt,
        arrivedAt: booking.arrivedAt,
        startedAt: booking.startedAt,
        completedAt: booking.completedAt,
      },
    };
  }

  async updateBookingWorkerLocation(workerId: string, bookingId: string, latitude: number, longitude: number) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.workerId !== workerId) throw new ForbiddenError('Unauthorized.');

    await db
      .update(workerProfiles)
      .set({
        latitude,
        longitude,
        lastLocationUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, workerId));

    return {
      bookingId,
      workerId,
      latitude,
      longitude,
      updatedAt: new Date(),
    };
  }
}

export const bookingService = new BookingService();
