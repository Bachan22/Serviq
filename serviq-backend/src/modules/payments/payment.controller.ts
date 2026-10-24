import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from './payment.service';
import { processPaymentSchema } from './payment.schemas';

export class PaymentController {
  async processPayment(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const input = processPaymentSchema.parse(request.body);
    const result = await paymentService.processPayment(userId, input);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async getPaymentByBooking(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const { bookingId } = request.params as { bookingId: string };
    const payment = await paymentService.getPaymentByBooking(userId, bookingId);
    return reply.status(200).send({
      success: true,
      data: payment,
    });
  }
}

export const paymentController = new PaymentController();
