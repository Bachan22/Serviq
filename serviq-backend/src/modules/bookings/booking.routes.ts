import { FastifyInstance } from 'fastify';
import { bookingController } from './booking.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function bookingRoutes(fastify: FastifyInstance) {
  // Customer creates direct booking
  fastify.post('/direct', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: bookingController.createDirectBooking.bind(bookingController),
  });

  // Customer creates broadcast booking
  fastify.post('/broadcast', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: bookingController.createBroadcastBooking.bind(bookingController),
  });

  // Worker views available broadcasts in their area
  fastify.get('/broadcasts/available', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.getAvailableBroadcasts.bind(bookingController),
  });

  // Worker claims a broadcast booking (concurrency safe with pessimistic lock)
  fastify.post('/:id/claim', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.claimBroadcastBooking.bind(bookingController),
  });

  // Worker accepts/declines direct booking
  fastify.patch('/:id/respond', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.workerRespondDirect.bind(bookingController),
  });

  // Worker updates job execution lifecycle status (ARRIVED, IN_PROGRESS, COMPLETED)
  fastify.patch('/:id/status', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.updateBookingStatus.bind(bookingController),
  });

  // Cancel booking (Customer or Worker or Admin)
  fastify.patch('/:id/cancel', {
    preHandler: [verifyAuth],
    handler: bookingController.cancelBooking.bind(bookingController),
  });

  // List bookings for authenticated customer/worker
  fastify.get('/', {
    preHandler: [verifyAuth],
    handler: bookingController.listBookings.bind(bookingController),
  });

  // Get full booking details with timeline & status history
  fastify.get('/:id', {
    preHandler: [verifyAuth],
    handler: bookingController.getBookingDetails.bind(bookingController),
  });
}
