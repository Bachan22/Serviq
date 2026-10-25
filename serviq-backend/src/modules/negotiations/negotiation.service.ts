import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../database/connection';
import { bookings } from '../../database/schema/bookings';
import { negotiationRounds } from '../../database/schema/negotiations';
import { bookingStatusHistory } from '../../database/schema/booking-status-history';
import { BusinessRules } from '../../config/business-rules';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  GoneError,
} from '../../common/errors/app-error';
import { SubmitEstimateInput, RespondEstimateInput } from './negotiation.schemas';

export class NegotiationService {
  async submitEstimate(workerId: string, bookingId: string, input: SubmitEstimateInput) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.workerId !== workerId) {
      throw new ForbiddenError('You are not the assigned service professional.');
    }

    if (!['ARRIVED', 'ESTIMATE_PROVIDED', 'NEGOTIATING'].includes(booking.status)) {
      throw new BadRequestError(`Cannot submit estimate while booking is in ${booking.status} status. Worker must arrive first.`);
    }

    // Check round count for worker
    const existingRounds = await db.query.negotiationRounds.findMany({
      where: eq(negotiationRounds.bookingId, bookingId),
    });

    const workerRounds = existingRounds.filter((r) => r.senderRole === 'WORKER');
    const maxRounds = BusinessRules.negotiation.maxRoundsPerParty; // 2

    if (workerRounds.length >= maxRounds) {
      throw new BadRequestError(`Maximum negotiation rounds reached (${maxRounds} rounds allowed per party).`);
    }

    const expiryMinutes = BusinessRules.negotiation.offerExpiryMinutes; // 15
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    return await db.transaction(async (tx) => {
      // Demote previous pending round if any
      await tx.update(negotiationRounds)
        .set({ status: 'COUNTERED', respondedAt: new Date() })
        .where(and(eq(negotiationRounds.bookingId, bookingId), eq(negotiationRounds.status, 'PENDING')));

      // Insert new estimate round
      const [newRound] = await tx.insert(negotiationRounds).values({
        bookingId,
        senderId: workerId,
        senderRole: 'WORKER',
        roundNumber: workerRounds.length + 1,
        proposedLaborPrice: input.proposedLaborPrice.toString(),
        proposedPartsPrice: input.proposedPartsPrice.toString(),
        itemizedLaborDetails: input.itemizedLaborDetails,
        itemizedPartsDetails: input.itemizedPartsDetails || [],
        status: 'PENDING',
        expiresAt,
      }).returning();

      // Update booking status to NEGOTIATING
      await tx.update(bookings).set({
        status: 'NEGOTIATING',
        updatedAt: new Date(),
      }).where(eq(bookings.id, bookingId));

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        fromStatus: booking.status,
        toStatus: 'NEGOTIATING',
        changedBy: workerId,
        changeReason: `Estimate submitted: ₹${input.proposedLaborPrice} labor + ₹${input.proposedPartsPrice} parts (Round ${newRound.roundNumber})`,
      });

      return newRound;
    });
  }

  async respondToEstimate(userId: string, bookingId: string, input: RespondEstimateInput) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerId === userId;

    if (!isCustomer && !isWorker) {
      throw new ForbiddenError('You are not authorized to participate in this negotiation.');
    }

    // Check if agreed price is already locked
    if (booking.agreedLaborPrice && ['IN_PROGRESS', 'COMPLETED'].includes(booking.status)) {
      throw new BadRequestError('Price agreement is already finalized and cannot be modified.');
    }

    // Find latest pending round
    const pendingRound = await db.query.negotiationRounds.findFirst({
      where: and(
        eq(negotiationRounds.bookingId, bookingId),
        eq(negotiationRounds.status, 'PENDING')
      ),
      orderBy: [desc(negotiationRounds.createdAt)],
    });

    if (!pendingRound) {
      throw new NotFoundError('No active pending quote or offer to respond to.');
    }

    // Active Query-Time Offer Expiry check
    if (new Date() > new Date(pendingRound.expiresAt)) {
      await db.update(negotiationRounds)
        .set({ status: 'EXPIRED', respondedAt: new Date() })
        .where(eq(negotiationRounds.id, pendingRound.id));

      throw new GoneError('The price offer has expired (15-minute validity window elapsed). Please request a fresh estimate.');
    }

    // Prevent user from responding to their own offer
    if (pendingRound.senderId === userId) {
      throw new BadRequestError('Cannot respond to your own offer. Awaiting response from the other party.');
    }

    // Role-based recipient authorization
    if (pendingRound.senderRole === 'WORKER' && !isCustomer) {
      throw new ForbiddenError('Only the customer can respond to this worker estimate.');
    }
    if (pendingRound.senderRole === 'CUSTOMER' && !isWorker) {
      throw new ForbiddenError('Only the assigned service professional can respond to this customer offer.');
    }

    const responderRole = isCustomer ? 'CUSTOMER' : 'WORKER';

    return await db.transaction(async (tx) => {
      if (input.action === 'ACCEPT') {
        // Accept price offer
        await tx.update(negotiationRounds)
          .set({ status: 'ACCEPTED', respondedAt: new Date() })
          .where(eq(negotiationRounds.id, pendingRound.id));

        const laborPrice = Number(pendingRound.proposedLaborPrice);
        const partsPrice = Number(pendingRound.proposedPartsPrice || 0);
        const totalPrice = laborPrice + partsPrice;

        // Transition booking: if worker has already arrived, transition to IN_PROGRESS, else ACCEPTED
        const nextStatus = booking.status === 'ARRIVED' ? 'IN_PROGRESS' : 'ACCEPTED';
        const startTimestamp = nextStatus === 'IN_PROGRESS' ? new Date() : null;

        const [updatedBooking] = await tx.update(bookings).set({
          agreedLaborPrice: laborPrice.toString(),
          agreedPartsPrice: partsPrice.toString(),
          finalTotalPrice: totalPrice.toString(),
          status: nextStatus,
          startedAt: startTimestamp,
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId)).returning();

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: userId,
          changeReason: `Offer accepted by ${responderRole.toLowerCase()}: ₹${totalPrice} (₹${laborPrice} labor + ₹${partsPrice} parts)`,
        });

        return {
          action: 'ACCEPTED',
          booking: updatedBooking,
        };
      } else if (input.action === 'COUNTER') {
        if (!input.counterLaborPrice) {
          throw new BadRequestError('Counter offer labor price is required.');
        }

        // Check responder round limit (max 2 rounds per party)
        const allRounds = await tx.query.negotiationRounds.findMany({
          where: eq(negotiationRounds.bookingId, bookingId),
        });
        const partyRounds = (allRounds || []).filter((r) => r.senderRole === responderRole);
        const maxRounds = BusinessRules.negotiation.maxRoundsPerParty; // 2

        if (partyRounds.length >= maxRounds) {
          throw new BadRequestError(`Maximum counter-offers reached (${maxRounds} allowed per party). You can accept or cancel.`);
        }

        // Mark previous round as COUNTERED
        await tx.update(negotiationRounds)
          .set({ status: 'COUNTERED', respondedAt: new Date() })
          .where(eq(negotiationRounds.id, pendingRound.id));

        const expiryMinutes = BusinessRules.negotiation.offerExpiryMinutes;
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        // Insert counter offer
        const [counterRound] = await tx.insert(negotiationRounds).values({
          bookingId,
          senderId: userId,
          senderRole: responderRole,
          roundNumber: partyRounds.length + 1,
          proposedLaborPrice: input.counterLaborPrice.toString(),
          proposedPartsPrice: pendingRound.proposedPartsPrice,
          itemizedLaborDetails: input.counterReason || `${responderRole === 'CUSTOMER' ? 'Customer' : 'Worker'} counter-offer`,
          status: 'PENDING',
          expiresAt,
        }).returning();

        await tx.update(bookings).set({
          status: 'NEGOTIATING',
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId));

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: booking.status,
          toStatus: 'NEGOTIATING',
          changedBy: userId,
          changeReason: `Counter offer submitted by ${responderRole.toLowerCase()}: ₹${input.counterLaborPrice} labor (Round ${counterRound.roundNumber})`,
        });

        return {
          action: 'COUNTERED',
          round: counterRound,
        };
      } else {
        // REJECT
        await tx.update(negotiationRounds)
          .set({ status: 'REJECTED', respondedAt: new Date() })
          .where(eq(negotiationRounds.id, pendingRound.id));

        await tx.update(bookings).set({
          status: 'CANCELLED',
          cancelledBy: responderRole,
          cancellationReason: input.counterReason || `Offer rejected by ${responderRole.toLowerCase()}`,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId));

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: booking.status,
          toStatus: 'CANCELLED',
          changedBy: userId,
          changeReason: `Offer rejected by ${responderRole.toLowerCase()}`,
        });

        return {
          action: 'REJECTED',
          message: 'Offer rejected and booking cancelled.',
        };
      }
    });
  }

  async getNegotiationHistory(userId: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.customerId !== userId && booking.workerId !== userId) {
      throw new ForbiddenError('You do not have access to this negotiation.');
    }

    const rounds = await db.query.negotiationRounds.findMany({
      where: eq(negotiationRounds.bookingId, bookingId),
      orderBy: [negotiationRounds.createdAt],
    });

    return rounds.map((r) => ({
      id: r.id,
      senderRole: r.senderRole,
      roundNumber: r.roundNumber,
      proposedLaborPrice: Number(r.proposedLaborPrice),
      proposedPartsPrice: Number(r.proposedPartsPrice),
      totalProposedPrice: Number(r.proposedLaborPrice) + Number(r.proposedPartsPrice),
      itemizedLaborDetails: r.itemizedLaborDetails,
      itemizedPartsDetails: r.itemizedPartsDetails,
      status: r.status,
      isExpired: new Date() > new Date(r.expiresAt),
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }
}

export const negotiationService = new NegotiationService();
