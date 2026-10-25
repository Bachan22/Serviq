import { FastifyInstance } from 'fastify';
import { bookingController } from './booking.controller.js';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth.js';

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

  // Worker claims a broadcast booking
  fastify.post('/:id/claim', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.claimBroadcastBooking.bind(bookingController),
  });

  // Worker creates offer (accept or counter)
  fastify.post('/:id/offers', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.createOffer.bind(bookingController),
  });

  // List offers for a job (Customer or Worker)
  fastify.get('/:id/offers', {
    preHandler: [verifyAuth],
    handler: bookingController.getJobOffers.bind(bookingController),
  });

  // Customer accepts a worker's offer
  fastify.post('/:id/offers/:offerId/accept', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: bookingController.acceptJobOffer.bind(bookingController),
  });

  // Customer rejects a worker's offer
  fastify.post('/:id/offers/:offerId/reject', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: bookingController.rejectJobOffer.bind(bookingController),
  });

  // Customer counters a worker's offer
  fastify.post('/:id/offers/:offerId/counter', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: bookingController.customerCounterOffer.bind(bookingController),
  });

  // Worker accepts/declines direct booking
  fastify.patch('/:id/respond', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.workerRespondDirect.bind(bookingController),
  });

  // Worker updates job execution status (ON_THE_WAY, ARRIVED, IN_PROGRESS with startCode, PAYMENT_PENDING)
  fastify.patch('/:id/status', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.updateBookingStatus.bind(bookingController),
  });

  // Customer confirms job completed (PAYMENT_PENDING -> COMPLETED, triggers simulated payout)
  fastify.post('/:id/confirm', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: bookingController.confirmCompletion.bind(bookingController),
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

  // Worker updates location during active booking
  fastify.patch('/:id/location', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: bookingController.updateWorkerLocation.bind(bookingController),
  });

  // Get live tracking information for authorized customer, worker, or admin
  fastify.get('/:id/tracking', {
    preHandler: [verifyAuth],
    handler: bookingController.getBookingTracking.bind(bookingController),
  });

  // Get full booking details with timeline & status history
  fastify.get('/:id', {
    preHandler: [verifyAuth],
    handler: bookingController.getBookingDetails.bind(bookingController),
  });
}
