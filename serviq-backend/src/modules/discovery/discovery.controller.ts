import { FastifyRequest, FastifyReply } from 'fastify';
import { discoveryService } from './discovery.service';
import { workerSearchQuerySchema } from './discovery.schemas';

export class DiscoveryController {
  async searchWorkers(request: FastifyRequest, reply: FastifyReply) {
    const validatedQuery = workerSearchQuerySchema.parse(request.query);
    const result = await discoveryService.searchWorkers(validatedQuery);
    return reply.status(200).send({
      success: true,
      data: result.workers,
      meta: result.pagination,
    });
  }
}

export const discoveryController = new DiscoveryController();
