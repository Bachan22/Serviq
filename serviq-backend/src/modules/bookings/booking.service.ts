import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../database/connection';
import { bookings } from '../../database/schema/bookings';
import { bookingBroadcasts } from '../../database/schema/booking-broadcasts';
import { bookingStatusHistory } from '../../database/schema/booking-status-history';
import { addresses } from '../../database/schema/addresses';
import { customerProfiles } from '../../database/schema/customer-profiles';
import { workerProfiles } from '../../database/schema/worker-profiles';
import { serviceCategories } from '../../database/schema/categories';
import { users } from '../../database/schema/users';
import { BusinessRules } from '../../config/business-rules';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../common/errors/app-error';
import {
  CreateDirectBookingInput,
  CreateBroadcastBookingInput,
  ListBookingsQueryInput,
} from './booking.schemas';

export class BookingService {
  private generateBookingNumber(): string {
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `BK-${Date.now().toString().slice(-6)}-${randomPart}`;
  }

  async createDirectBooking(customerId: string, input: CreateDirectBookingInput) {
    // 1. Fetch and validate customer address
    const address = await db.query.addresses.findFirst({
      where: and(eq(addresses.id, input.addressId), eq(addresses.customerId, customerId)),
    });
    if (!address) {
      throw new NotFoundError('Selected address not found for this customer account.');
    }

    // 2. Fetch and validate category
    const category = await db.query.serviceCategories.findFirst({
      where: and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.isActive, true)),
    });
    if (!category) {
      throw new BadRequestError('Active service category not found.');
    }

    // 3. Fetch and validate worker
    const worker = await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, input.workerId),
    });
    const workerUser = await db.query.users.findFirst({
      where: eq(users.id, input.workerId),
    });
    if (!worker || !workerUser || workerUser.status !== 'ACTIVE' || !worker.isVerified) {
      throw new BadRequestError('Selected service professional is not eligible or verified.');
    }

    // Format address snapshot
    const addressText = `${address.addressLine1}${address.addressLine2 ? ', ' + address.addressLine2 : ''}, ${address.locality}, ${address.city}, ${address.state} - ${address.postalCode}`;

    const bookingNumber = this.generateBookingNumber();

    return await db.transaction(async (tx) => {
      const [newBooking] = await tx.insert(bookings).values({
        bookingNumber,
        customerId,
        workerId: input.workerId,
        categoryId: input.categoryId,
        addressId: input.addressId,
        serviceAddressText: addressText,
        serviceLatitude: address.latitude,
        serviceLongitude: address.longitude,
        status: 'PENDING_ACCEPTANCE',
        dispatchType: 'DIRECT',
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        customerNotes: input.customerNotes,
        audioNoteUrl: input.audioNoteUrl,
        problemImages: input.problemImages || [],
      }).returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId: newBooking.id,
        toStatus: 'PENDING_ACCEPTANCE',
        changedBy: customerId,
        changeReason: 'Direct booking created by customer',
      });

      return newBooking;
    });
  }

  async createBroadcastBooking(customerId: string, input: CreateBroadcastBookingInput) {
    const address = await db.query.addresses.findFirst({
      where: and(eq(addresses.id, input.addressId), eq(addresses.customerId, customerId)),
    });
    if (!address) {
      throw new NotFoundError('Selected address not found.');
    }

    const category = await db.query.serviceCategories.findFirst({
      where: and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.isActive, true)),
    });
    if (!category) {
      throw new BadRequestError('Active service category not found.');
    }

    const addressText = `${address.addressLine1}${address.addressLine2 ? ', ' + address.addressLine2 : ''}, ${address.locality}, ${address.city}, ${address.state} - ${address.postalCode}`;
    const bookingNumber = this.generateBookingNumber();
    const radiusMeters = (input.searchRadiusKm || 10) * 1000;

    // Find nearby eligible online workers matching category via PostGIS
    const nearbyWorkersQuery = sql`
      SELECT w.id
      FROM worker_profiles w
      JOIN users u ON u.id = w.id
      JOIN worker_skills ws ON ws.worker_id = w.id
      WHERE u.status = 'ACTIVE'
        AND w.is_verified = true
        AND w.verification_status = 'APPROVED'
        AND w.is_online = true
        AND ws.category_id = ${input.categoryId}
        AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${address.longitude}, ${address.latitude}), 4326)::geography,
          LEAST(${radiusMeters}, (w.service_radius_km * 1000)::double precision)
        )
      LIMIT 20
    `;

    const nearbyWorkers = await db.execute<{ id: string }>(nearbyWorkersQuery);

    return await db.transaction(async (tx) => {
      const [newBooking] = await tx.insert(bookings).values({
        bookingNumber,
        customerId,
        categoryId: input.categoryId,
        addressId: input.addressId,
        serviceAddressText: addressText,
        serviceLatitude: address.latitude,
        serviceLongitude: address.longitude,
        status: 'BROADCASTING',
        dispatchType: 'BROADCAST',
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        customerNotes: input.customerNotes,
        audioNoteUrl: input.audioNoteUrl,
        problemImages: input.problemImages || [],
      }).returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId: newBooking.id,
        toStatus: 'BROADCASTING',
        changedBy: customerId,
        changeReason: `Broadcast dispatch initiated to ${nearbyWorkers.length} nearby professionals`,
      });

      // Record broadcast dispatches
      for (const w of nearbyWorkers) {
        await tx.insert(bookingBroadcasts).values({
          bookingId: newBooking.id,
          workerId: w.id,
          status: 'SENT',
        });
      }

      return {
        ...newBooking,
        broadcastRecipientCount: nearbyWorkers.length,
      };
    });
  }

  /**
   * Concurrency Safe Broadcast Claiming with Pessimistic Row Locking
   */
  async claimBroadcastBooking(workerId: string, bookingId: string) {
    return await db.transaction(async (tx) => {
      // 1. Pessimistic lock row FOR UPDATE
      const lockQuery = sql`
        SELECT *
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE
      `;
      const lockResult = await tx.execute<any>(lockQuery);
      const booking = lockResult[0];

      if (!booking) {
        throw new NotFoundError('Booking request not found.');
      }

      if (booking.status !== 'BROADCASTING' || booking.worker_id !== null) {
        throw new ConflictError(
          'This service request has already been claimed or is no longer available.',
          'BOOKING_ALREADY_CLAIMED'
        );
      }

      // 2. Assign worker and transition to ACCEPTED
      const [updated] = await tx.update(bookings).set({
        workerId,
        status: 'ACCEPTED',
        dispatchedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(bookings.id, bookingId)).returning();

      // 3. Mark claimant as CLAIMED and other broadcasts as EXPIRED
      await tx.update(bookingBroadcasts)
        .set({ status: 'CLAIMED', respondedAt: new Date() })
        .where(and(eq(bookingBroadcasts.bookingId, bookingId), eq(bookingBroadcasts.workerId, workerId)));

      await tx.update(bookingBroadcasts)
        .set({ status: 'EXPIRED' })
        .where(and(eq(bookingBroadcasts.bookingId, bookingId), sql`worker_id != ${workerId}`));

      // 4. Log status history
      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: 'BROADCASTING',
        toStatus: 'ACCEPTED',
        changedBy: workerId,
        changeReason: 'Claimed by nearby service professional',
      });

      return updated;
    });
  }

  async workerRespondDirect(workerId: string, bookingId: string, action: 'ACCEPT' | 'DECLINE', reason?: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.workerId !== workerId) {
      throw new ForbiddenError('You are not the assigned professional for this booking.');
    }

    if (booking.status !== 'PENDING_ACCEPTANCE') {
      throw new BadRequestError(`Cannot respond to booking in current status: ${booking.status}`);
    }

    return await db.transaction(async (tx) => {
      if (action === 'ACCEPT') {
        const [updated] = await tx.update(bookings).set({
          status: 'ACCEPTED',
          dispatchedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId)).returning();

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: 'PENDING_ACCEPTANCE',
          toStatus: 'ACCEPTED',
          changedBy: workerId,
          changeReason: 'Direct booking accepted by professional',
        });

        return updated;
      } else {
        const [updated] = await tx.update(bookings).set({
          status: 'CANCELLED',
          cancelledBy: 'WORKER',
          cancellationReason: reason || 'Declined by professional',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId)).returning();

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: 'PENDING_ACCEPTANCE',
          toStatus: 'CANCELLED',
          changedBy: workerId,
          changeReason: reason || 'Direct booking declined by professional',
        });

        return updated;
      }
    });
  }

  async updateBookingStatus(workerId: string, bookingId: string, newStatus: 'ARRIVED' | 'IN_PROGRESS' | 'PAYMENT_PENDING' | 'COMPLETED') {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.workerId !== workerId) {
      throw new ForbiddenError('You are not assigned to this booking.');
    }

    const currentStatus = booking.status;

    // Validate valid state transitions
    const validTransitions: Record<string, string[]> = {
      ACCEPTED: ['ARRIVED'],
      ARRIVED: ['IN_PROGRESS'],
      NEGOTIATING: ['IN_PROGRESS'],
      ESTIMATE_PROVIDED: ['IN_PROGRESS'],
      IN_PROGRESS: ['PAYMENT_PENDING', 'COMPLETED'],
      PAYMENT_PENDING: ['COMPLETED'],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestError(`Invalid transition from ${currentStatus} to ${newStatus}.`);
    }

    return await db.transaction(async (tx) => {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === 'ARRIVED') updateData.arrivedAt = new Date();
      if (newStatus === 'IN_PROGRESS') updateData.startedAt = new Date();
      if (newStatus === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.paymentStatus = 'PAID';

        // Increment worker completed jobs count
        await tx.update(workerProfiles)
          .set({ completedJobsCount: sql`${workerProfiles.completedJobsCount} + 1` })
          .where(eq(workerProfiles.id, workerId));
      }

      const [updated] = await tx.update(bookings)
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
  }

  async cancelBooking(userId: string, role: string, bookingId: string, reason: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerId === userId;
    const isAdmin = role.includes('ADMIN');

    if (!isCustomer && !isWorker && !isAdmin) {
      throw new ForbiddenError('You are not authorized to cancel this booking.');
    }

    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      throw new BadRequestError(`Cannot cancel a booking that is already ${booking.status}.`);
    }

    if (booking.status === 'IN_PROGRESS' && !isAdmin) {
      throw new BadRequestError('Work is already in progress. Please contact support to resolve or dispute.');
    }

    // Cancellation fee calculation
    let tripFee = 0;
    let workerShare = 0;
    let platformFee = 0;

    if (isCustomer && ['ACCEPTED', 'ARRIVED'].includes(booking.status)) {
      const minutesElapsed = (Date.now() - new Date(booking.createdAt).getTime()) / (1000 * 60);
      const gracePeriod = BusinessRules.cancellation.gracePeriodMinutes; // default 5 minutes

      if (minutesElapsed > gracePeriod) {
        tripFee = BusinessRules.cancellation.tripFeeAmount; // default ₹100
        const workerSharePct = BusinessRules.cancellation.workerSharePct; // default 85%
        workerShare = Math.round((tripFee * workerSharePct) / 100);
        platformFee = tripFee - workerShare;
      }
    }

    return await db.transaction(async (tx) => {
      const [cancelled] = await tx.update(bookings).set({
        status: 'CANCELLED',
        cancelledBy: isCustomer ? 'CUSTOMER' : (isWorker ? 'WORKER' : 'ADMIN'),
        cancellationReason: reason,
        cancellationTripFee: tripFee.toString(),
        workerCancellationShare: workerShare.toString(),
        platformCancellationFee: platformFee.toString(),
        cancelledAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(bookings.id, bookingId)).returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: booking.status,
        toStatus: 'CANCELLED',
        changedBy: userId,
        changeReason: `Cancelled: ${reason}. Trip fee charged: ₹${tripFee}`,
      });

      return cancelled;
    });
  }

  async getBookingDetails(userId: string, role: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerId === userId;
    const isAdmin = role.includes('ADMIN');

    if (!isCustomer && !isWorker && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this booking.');
    }

    // Enriched customer & worker details
    const customer = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.id, booking.customerId),
    });
    const customerUser = await db.query.users.findFirst({
      where: eq(users.id, booking.customerId),
    });

    let worker = null;
    let workerUser = null;
    if (booking.workerId) {
      worker = await db.query.workerProfiles.findFirst({
        where: eq(workerProfiles.id, booking.workerId),
      });
      workerUser = await db.query.users.findFirst({
        where: eq(users.id, booking.workerId),
      });
    }

    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, booking.categoryId),
    });

    const history = await db.query.bookingStatusHistory.findMany({
      where: eq(bookingStatusHistory.bookingId, bookingId),
      orderBy: [desc(bookingStatusHistory.createdAt)],
    });

    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      dispatchType: booking.dispatchType,
      scheduledFor: booking.scheduledFor,
      customerNotes: booking.customerNotes,
      audioNoteUrl: booking.audioNoteUrl,
      problemImages: booking.problemImages,
      serviceAddress: {
        fullText: booking.serviceAddressText,
        latitude: booking.serviceLatitude,
        longitude: booking.serviceLongitude,
      },
      pricing: {
        agreedLaborPrice: booking.agreedLaborPrice ? Number(booking.agreedLaborPrice) : null,
        agreedPartsPrice: booking.agreedPartsPrice ? Number(booking.agreedPartsPrice) : 0,
        finalTotalPrice: booking.finalTotalPrice ? Number(booking.finalTotalPrice) : null,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
      },
      cancellation: booking.cancelledAt ? {
        cancelledBy: booking.cancelledBy,
        cancellationReason: booking.cancellationReason,
        tripFee: Number(booking.cancellationTripFee),
        workerShare: Number(booking.workerCancellationShare),
      } : null,
      customer: {
        id: booking.customerId,
        displayName: customer?.displayName || 'Customer',
        // Phone number revealed to assigned worker only when active
        phoneNumber: (isWorker && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(booking.status)) ? customerUser?.phoneNumber : undefined,
      },
      worker: worker ? {
        id: worker.id,
        displayName: worker.displayName,
        averageRating: Number(worker.averageRating),
        // Worker phone revealed to customer once accepted
        phoneNumber: isCustomer ? workerUser?.phoneNumber : undefined,
      } : null,
      category: category ? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        iconKey: category.iconKey,
      } : null,
      timeline: {
        createdAt: booking.createdAt,
        dispatchedAt: booking.dispatchedAt,
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

    return {
      bookings: list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAvailableBroadcasts(workerId: string) {
    // Return all pending broadcasts directed to this worker
    const list = await db.select({
      broadcastId: bookingBroadcasts.id,
      bookingId: bookings.id,
      bookingNumber: bookings.bookingNumber,
      categoryName: serviceCategories.name,
      categorySlug: serviceCategories.slug,
      serviceAddressText: bookings.serviceAddressText,
      customerNotes: bookings.customerNotes,
      scheduledFor: bookings.scheduledFor,
      createdAt: bookings.createdAt,
    })
      .from(bookingBroadcasts)
      .innerJoin(bookings, eq(bookingBroadcasts.bookingId, bookings.id))
      .innerJoin(serviceCategories, eq(bookings.categoryId, serviceCategories.id))
      .where(and(
        eq(bookingBroadcasts.workerId, workerId),
        eq(bookingBroadcasts.status, 'SENT'),
        eq(bookings.status, 'BROADCASTING')
      ))
      .orderBy(desc(bookings.createdAt));

    return list;
  }

  async getBookingTracking(userId: string, role: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerId === userId;
    const isAdmin = role.includes('ADMIN');

    if (!isCustomer && !isWorker && !isAdmin) {
      throw new ForbiddenError('Unauthorized: You cannot access live tracking for this booking.');
    }

    const worker = booking.workerId ? await db.query.workerProfiles.findFirst({
      where: eq(workerProfiles.id, booking.workerId),
    }) : null;

    const workerUser = booking.workerId ? await db.query.users.findFirst({
      where: eq(users.id, booking.workerId),
    }) : null;

    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, booking.categoryId),
    });

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
      worker: worker ? {
        id: worker.id,
        displayName: worker.displayName,
        averageRating: Number(worker.averageRating),
        totalReviewsCount: worker.totalReviewsCount,
        phoneNumber: isCustomer ? workerUser?.phoneNumber : undefined,
        latitude: worker.latitude,
        longitude: worker.longitude,
        lastLocationUpdatedAt: worker.lastLocationUpdatedAt,
      } : null,
      timeline: {
        createdAt: booking.createdAt,
        dispatchedAt: booking.dispatchedAt,
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

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.workerId !== workerId) {
      throw new ForbiddenError('You are not the assigned professional for this booking.');
    }

    if (!['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(booking.status)) {
      throw new BadRequestError(`Cannot update live location for booking in status ${booking.status}`);
    }

    // Update worker profile location & timestamp
    await db.update(workerProfiles)
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
