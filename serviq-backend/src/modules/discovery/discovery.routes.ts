import { FastifyInstance } from 'fastify';
import { discoveryController } from './discovery.controller';

export async function discoveryRoutes(fastify: FastifyInstance) {
  fastify.get('/search', {
    handler: discoveryController.searchWorkers.bind(discoveryController),
  });
}
