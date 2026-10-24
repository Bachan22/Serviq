import { FastifyInstance } from 'fastify';
import { paymentController } from './payment.controller';
import { verifyAuth } from '../../common/middlewares/auth';

export async function paymentRoutes(fastify: FastifyInstance) {
  // Settle payment (COD collection confirmation or online payment completion)
  fastify.post('/process', {
    preHandler: [verifyAuth],
    handler: paymentController.processPayment.bind(paymentController),
  });

  // Get payment receipt by booking
  fastify.get('/booking/:bookingId', {
    preHandler: [verifyAuth],
    handler: paymentController.getPaymentByBooking.bind(paymentController),
  });
}
