import { eq } from 'drizzle-orm';
import { db } from '../../database/connection';
import { payments } from '../../database/schema/payments';
import { bookings } from '../../database/schema/bookings';
import { bookingStatusHistory } from '../../database/schema/booking-status-history';
import { walletService } from '../wallets/wallet.service';
import { BusinessRules } from '../../config/business-rules';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../common/errors/app-error';
import { ProcessPaymentInput } from './payment.schemas';

export class PaymentService {
  async processPayment(userId: string, input: ProcessPaymentInput) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, input.bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.customerId !== userId && booking.workerId !== userId) {
      throw new ForbiddenError('You are not authorized to process payment for this booking.');
    }

    if (!['IN_PROGRESS', 'PAYMENT_PENDING', 'COMPLETED'].includes(booking.status)) {
      throw new BadRequestError(`Cannot settle payment for booking in current status: ${booking.status}`);
    }

    if (booking.paymentStatus === 'PAID') {
      throw new BadRequestError('This booking has already been paid and settled.');
    }

    if (!booking.workerId) {
      throw new BadRequestError('No service professional assigned to settle payment.');
    }

    const laborAmount = Number(booking.agreedLaborPrice || 0);
    const partsAmount = Number(booking.agreedPartsPrice || 0);
    const totalAmount = Number(booking.finalTotalPrice || (laborAmount + partsAmount));

    if (totalAmount <= 0) {
      throw new BadRequestError('Invalid or unnegotiated booking price.');
    }

    // Platform commission is 10% on LABOR ONLY (0% on parts)
    const commissionRatePct = BusinessRules.commission.serviceLaborRatePct; // 10%
    const platformCommission = Math.round((laborAmount * commissionRatePct) / 100);
    const workerPayoutAmount = totalAmount - platformCommission;

    return await db.transaction(async (tx) => {
      // 1. Create payment record
      const [payment] = await tx.insert(payments).values({
        bookingId: booking.id,
        customerId: booking.customerId,
        amount: totalAmount.toFixed(2),
        paymentMethod: input.paymentMethod,
        gatewayPaymentId: input.gatewayPaymentId || (input.paymentMethod !== 'CASH_ON_DELIVERY' ? `PAY-${Date.now().toString().slice(-6)}` : null),
        status: 'SUCCESS',
        laborAmount: laborAmount.toFixed(2),
        partsAmount: partsAmount.toFixed(2),
        platformCommission: platformCommission.toFixed(2),
        workerPayoutAmount: workerPayoutAmount.toFixed(2),
        settledAt: new Date(),
      }).returning();

      // 2. Adjust worker wallet according to payment method
      if (input.paymentMethod === 'CASH_ON_DELIVERY') {
        // Customer paid worker cash in full -> deduct 10% labor commission from worker's wallet
        await walletService.recordCommissionDeduction(tx, booking.workerId!, booking.id, platformCommission);
      } else {
        // Customer paid online -> credit worker wallet with net earnings (labor after commission + parts)
        await walletService.recordOnlinePayout(tx, booking.workerId!, booking.id, workerPayoutAmount);
      }

      // 3. Update booking status to COMPLETED & PAID
      const [updatedBooking] = await tx.update(bookings).set({
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        completedAt: booking.completedAt || new Date(),
        updatedAt: new Date(),
      }).where(eq(bookings.id, booking.id)).returning();

      // 4. Log status history
      await tx.insert(bookingStatusHistory).values({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'COMPLETED',
        changedBy: userId,
        changeReason: `Payment settled via ${input.paymentMethod}: ₹${totalAmount} (Commission: ₹${platformCommission}, Worker Net: ₹${workerPayoutAmount})`,
      });

      return {
        payment,
        booking: updatedBooking,
        breakdown: {
          totalAmount,
          laborAmount,
          partsAmount,
          commissionRatePct,
          platformCommission,
          workerPayoutAmount,
        },
      };
    });
  }

  async getPaymentByBooking(userId: string, bookingId: string) {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.customerId !== userId && booking.workerId !== userId) {
      throw new ForbiddenError('You do not have access to this payment information.');
    }

    const payment = await db.query.payments.findFirst({
      where: eq(payments.bookingId, bookingId),
    });

    return payment || null;
  }
}

export const paymentService = new PaymentService();
