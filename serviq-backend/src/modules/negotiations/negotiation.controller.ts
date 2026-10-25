import { FastifyRequest, FastifyReply } from 'fastify';
import { negotiationService } from './negotiation.service';
import { submitEstimateSchema, respondEstimateSchema } from './negotiation.schemas';

export class NegotiationController {
  async submitEstimate(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { id: bookingId } = request.params as { id: string };
    const input = submitEstimateSchema.parse(request.body);
    const round = await negotiationService.submitEstimate(workerId, bookingId, input);
    return reply.status(201).send({
      success: true,
      data: round,
    });
  }

  async respondToEstimate(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const { id: bookingId } = request.params as { id: string };
    const input = respondEstimateSchema.parse(request.body);
    const result = await negotiationService.respondToEstimate(userId, bookingId, input);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async getNegotiationHistory(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const { id: bookingId } = request.params as { id: string };
    const history = await negotiationService.getNegotiationHistory(userId, bookingId);
    return reply.status(200).send({
      success: true,
      data: history,
    });
  }
}

export const negotiationController = new NegotiationController();
