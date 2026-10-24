import { FastifyInstance } from 'fastify';
import { negotiationController } from './negotiation.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function negotiationRoutes(fastify: FastifyInstance) {
  // Worker submits estimate (Round 1 or counter)
  fastify.post('/bookings/:id/estimate', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: negotiationController.submitEstimate.bind(negotiationController),
  });

  // Customer responds to estimate (Accept, Counter, Reject)
  fastify.post('/bookings/:id/respond', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: negotiationController.respondToEstimate.bind(negotiationController),
  });

  // Get negotiation history for a booking
  fastify.get('/bookings/:id/negotiation', {
    preHandler: [verifyAuth],
    handler: negotiationController.getNegotiationHistory.bind(negotiationController),
  });
}
