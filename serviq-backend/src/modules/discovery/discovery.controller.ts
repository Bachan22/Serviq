import { FastifyRequest, FastifyReply } from 'fastify';
import { discoveryService } from './discovery.service.js';
import { workerSearchQuerySchema, nearbyWorkersQuerySchema } from './discovery.schemas.js';

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

  async getNearbyWorkers(request: FastifyRequest, reply: FastifyReply) {
    const validatedQuery = nearbyWorkersQuerySchema.parse(request.query);
    const clientKey = (request as any).user?.id || request.ip || 'anonymous';
    const workers = await discoveryService.getNearbyWorkers(validatedQuery, clientKey);
    return reply.status(200).send({
      success: true,
      data: workers,
    });
  }
}

export const discoveryController = new DiscoveryController();
