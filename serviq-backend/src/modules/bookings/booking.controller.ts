import { FastifyRequest, FastifyReply } from 'fastify';
import { bookingService } from './booking.service';
import {
  createDirectBookingSchema,
  createBroadcastBookingSchema,
  workerRespondDirectSchema,
  updateBookingStatusSchema,
  cancelBookingSchema,
  listBookingsQuerySchema,
  updateBookingLocationSchema,
} from './booking.schemas';

export class BookingController {
  async createDirectBooking(request: FastifyRequest, reply: FastifyReply) {
    const customerId = request.user.id;
    const input = createDirectBookingSchema.parse(request.body);
    const booking = await bookingService.createDirectBooking(customerId, input);
    return reply.status(201).send({
      success: true,
      data: booking,
    });
  }

  async createBroadcastBooking(request: FastifyRequest, reply: FastifyReply) {
    const customerId = request.user.id;
    const input = createBroadcastBookingSchema.parse(request.body);
    const result = await bookingService.createBroadcastBooking(customerId, input);
    return reply.status(201).send({
      success: true,
      data: result,
    });
  }

  async claimBroadcastBooking(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { id } = request.params as { id: string };
    const claimed = await bookingService.claimBroadcastBooking(workerId, id);
    return reply.status(200).send({
      success: true,
      data: claimed,
    });
  }

  async workerRespondDirect(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { id } = request.params as { id: string };
    const { action, declineReason } = workerRespondDirectSchema.parse(request.body);
    const result = await bookingService.workerRespondDirect(workerId, id, action, declineReason);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async updateBookingStatus(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { id } = request.params as { id: string };
    const { status } = updateBookingStatusSchema.parse(request.body);
    const updated = await bookingService.updateBookingStatus(workerId, id, status);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async cancelBooking(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const userRole = request.user.roles[0] || 'CUSTOMER';
    const { id } = request.params as { id: string };
    const { cancellationReason } = cancelBookingSchema.parse(request.body);
    const cancelled = await bookingService.cancelBooking(userId, userRole, id, cancellationReason);
    return reply.status(200).send({
      success: true,
      data: cancelled,
    });
  }

  async getBookingDetails(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const userRole = request.user.roles[0] || 'CUSTOMER';
    const { id } = request.params as { id: string };
    const booking = await bookingService.getBookingDetails(userId, userRole, id);
    return reply.status(200).send({
      success: true,
      data: booking,
    });
  }

  async listBookings(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const userRole = request.user.roles.includes('WORKER') ? 'WORKER' : 'CUSTOMER';
    const query = listBookingsQuerySchema.parse(request.query);
    const result = await bookingService.listBookings(userId, userRole, query);
    return reply.status(200).send({
      success: true,
      data: result.bookings,
      meta: result.pagination,
    });
  }

  async getAvailableBroadcasts(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const broadcasts = await bookingService.getAvailableBroadcasts(workerId);
    return reply.status(200).send({
      success: true,
      data: broadcasts,
    });
  }

  async getBookingTracking(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const userRole = request.user.roles.includes('WORKER') ? 'WORKER' : 'CUSTOMER';
    const { id } = request.params as { id: string };
    const tracking = await bookingService.getBookingTracking(userId, userRole, id);
    return reply.status(200).send({
      success: true,
      data: tracking,
    });
  }

  async updateWorkerLocation(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { id } = request.params as { id: string };
    const input = updateBookingLocationSchema.parse(request.body);
    const result = await bookingService.updateBookingWorkerLocation(workerId, id, input.latitude, input.longitude);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}

export const bookingController = new BookingController();
