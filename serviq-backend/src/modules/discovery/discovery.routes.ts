import { FastifyInstance } from 'fastify';
import { discoveryController } from './discovery.controller.js';

export async function discoveryRoutes(fastify: FastifyInstance) {
  fastify.get('/search', {
    handler: discoveryController.searchWorkers.bind(discoveryController),
  });

  fastify.get('/nearby', {
    handler: discoveryController.getNearbyWorkers.bind(discoveryController),
  });
}
