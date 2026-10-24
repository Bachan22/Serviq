import { FastifyInstance } from 'fastify';
import { workerController } from './worker.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function workerRoutes(fastify: FastifyInstance) {
  // Worker own profile routes
  fastify.get('/me', {
    preHandler: [verifyAuth, requireRoles(['WORKER', 'ADMIN'])],
    handler: workerController.getOwnProfile.bind(workerController),
  });

  fastify.put('/me', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: workerController.updateOwnProfile.bind(workerController),
  });

  fastify.patch('/availability', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: workerController.updateAvailability.bind(workerController),
  });

  fastify.patch('/location', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: workerController.updateLocation.bind(workerController),
  });

  fastify.get('/skills', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: workerController.getOwnSkills.bind(workerController),
  });

  fastify.post('/skills', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: workerController.addSkill.bind(workerController),
  });

  fastify.delete('/skills/:categoryId', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: workerController.removeSkill.bind(workerController),
  });

  // Admin verification route
  fastify.patch('/:id/verification', {
    preHandler: [verifyAuth, requireRoles(['ADMIN'])],
    handler: workerController.adminVerifyWorker.bind(workerController),
  });

  // Public worker profile
  fastify.get('/:id', {
    handler: workerController.getPublicProfile.bind(workerController),
  });
}
