import { FastifyRequest, FastifyReply } from 'fastify';
import { reviewService } from './review.service';
import {
  createReviewSchema,
  replyReviewSchema,
  listReviewsQuerySchema,
} from './review.schemas';

export class ReviewController {
  async createReview(request: FastifyRequest, reply: FastifyReply) {
    const customerId = request.user.id;
    const input = createReviewSchema.parse(request.body);
    const result = await reviewService.createReview(customerId, input);
    return reply.status(201).send({
      success: true,
      data: result,
    });
  }

  async replyToReview(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { id } = request.params as { id: string };
    const input = replyReviewSchema.parse(request.body);
    const updated = await reviewService.replyToReview(workerId, id, input);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async getWorkerReviews(request: FastifyRequest, reply: FastifyReply) {
    const { id: workerId } = request.params as { id: string };
    const query = listReviewsQuerySchema.parse(request.query);
    const result = await reviewService.getWorkerReviews(workerId, query);
    return reply.status(200).send({
      success: true,
      data: result.reviews,
      meta: result.pagination,
    });
  }
}

export const reviewController = new ReviewController();
