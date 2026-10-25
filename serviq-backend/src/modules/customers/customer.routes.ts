import { FastifyInstance } from 'fastify';
import { customerController } from './customer.controller.js';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth.js';

export async function customerRoutes(fastify: FastifyInstance) {
  fastify.get('/me', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, customerController.getMe.bind(customerController));

  fastify.put('/me', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, customerController.updateMe.bind(customerController));

  // Saved Workers
  fastify.get('/saved-workers', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, customerController.getSavedWorkers.bind(customerController));

  fastify.post('/saved-workers/:workerId', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, customerController.saveWorker.bind(customerController));

  fastify.delete('/saved-workers/:workerId', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, customerController.removeSavedWorker.bind(customerController));
}
