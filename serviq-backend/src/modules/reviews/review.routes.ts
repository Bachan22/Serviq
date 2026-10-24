import { FastifyInstance } from 'fastify';
import { reviewController } from './review.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function reviewRoutes(fastify: FastifyInstance) {
  // Customer submits review for a completed service
  fastify.post('/reviews', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
    handler: reviewController.createReview.bind(reviewController),
  });

  // Worker replies to a review on their profile
  fastify.post('/reviews/:id/reply', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: reviewController.replyToReview.bind(reviewController),
  });

  // Public: List verified reviews on a worker's profile
  fastify.get('/workers/:id/reviews', {
    handler: reviewController.getWorkerReviews.bind(reviewController),
  });
}
