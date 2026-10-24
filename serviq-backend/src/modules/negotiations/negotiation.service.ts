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

  async respondToEstimate(customerId: string, bookingId: string, input: RespondEstimateInput) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenError('You do not own this booking.');
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
      throw new NotFoundError('No active pending quote to respond to.');
    }

    // Active Query-Time Offer Expiry check
    if (new Date() > new Date(pendingRound.expiresAt)) {
      await db.update(negotiationRounds)
        .set({ status: 'EXPIRED', respondedAt: new Date() })
        .where(eq(negotiationRounds.id, pendingRound.id));

      throw new GoneError('The price offer has expired (15-minute validity window elapsed). Please request a fresh estimate.');
    }

    return await db.transaction(async (tx) => {
      if (input.action === 'ACCEPT') {
        // Accept price offer
        await tx.update(negotiationRounds)
          .set({ status: 'ACCEPTED', respondedAt: new Date() })
          .where(eq(negotiationRounds.id, pendingRound.id));

        const laborPrice = Number(pendingRound.proposedLaborPrice);
        const partsPrice = Number(pendingRound.proposedPartsPrice);
        const totalPrice = laborPrice + partsPrice;

        // Transition booking to IN_PROGRESS
        const [updatedBooking] = await tx.update(bookings).set({
          agreedLaborPrice: laborPrice.toString(),
          agreedPartsPrice: partsPrice.toString(),
          finalTotalPrice: totalPrice.toString(),
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId)).returning();

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: 'NEGOTIATING',
          toStatus: 'IN_PROGRESS',
          changedBy: customerId,
          changeReason: `Offer accepted by customer: ₹${totalPrice} (₹${laborPrice} labor + ₹${partsPrice} parts)`,
        });

        return {
          action: 'ACCEPTED',
          booking: updatedBooking,
        };
      } else if (input.action === 'COUNTER') {
        if (!input.counterLaborPrice) {
          throw new BadRequestError('Counter offer labor price is required.');
        }

        // Check customer round limit
        const allRounds = await tx.query.negotiationRounds.findMany({
          where: eq(negotiationRounds.bookingId, bookingId),
        });
        const customerRounds = allRounds.filter((r) => r.senderRole === 'CUSTOMER');
        const maxRounds = BusinessRules.negotiation.maxRoundsPerParty; // 2

        if (customerRounds.length >= maxRounds) {
          throw new BadRequestError(`Maximum counter-offers reached (${maxRounds} allowed per party). You can accept or cancel.`);
        }

        // Mark worker round as COUNTERED
        await tx.update(negotiationRounds)
          .set({ status: 'COUNTERED', respondedAt: new Date() })
          .where(eq(negotiationRounds.id, pendingRound.id));

        const expiryMinutes = BusinessRules.negotiation.offerExpiryMinutes;
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        // Insert customer counter offer
        const [counterRound] = await tx.insert(negotiationRounds).values({
          bookingId,
          senderId: customerId,
          senderRole: 'CUSTOMER',
          roundNumber: customerRounds.length + 1,
          proposedLaborPrice: input.counterLaborPrice.toString(),
          proposedPartsPrice: pendingRound.proposedPartsPrice,
          itemizedLaborDetails: input.counterReason || 'Customer counter-offer',
          status: 'PENDING',
          expiresAt,
        }).returning();

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: 'NEGOTIATING',
          toStatus: 'NEGOTIATING',
          changedBy: customerId,
          changeReason: `Counter offer submitted by customer: ₹${input.counterLaborPrice} labor (Round ${counterRound.roundNumber})`,
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

        await tx.insert(bookingStatusHistory).values({
          bookingId,
          fromStatus: 'NEGOTIATING',
          toStatus: 'NEGOTIATING',
          changedBy: customerId,
          changeReason: 'Offer rejected by customer',
        });

        return {
          action: 'REJECTED',
          message: 'Estimate rejected. You may request another estimate or cancel the booking.',
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
