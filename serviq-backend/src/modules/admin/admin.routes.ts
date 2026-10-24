import { FastifyInstance } from 'fastify';
import { adminController } from './admin.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function adminRoutes(fastify: FastifyInstance) {
  // Worker uploads verification document
  fastify.post('/workers/me/documents', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: adminController.submitDocument.bind(adminController),
  });

  // Worker views their submitted documents
  fastify.get('/workers/me/documents', {
    preHandler: [verifyAuth, requireRoles(['WORKER'])],
    handler: adminController.getMyDocuments.bind(adminController),
  });

  // Admin lists pending verification queue
  fastify.get('/admin/verifications', {
    preHandler: [verifyAuth, requireRoles(['ADMIN', 'SUPPORT'])],
    handler: adminController.listPendingVerifications.bind(adminController),
  });

  // Admin approves or rejects specific document
  fastify.patch('/admin/verifications/documents/:id', {
    preHandler: [verifyAuth, requireRoles(['ADMIN'])],
    handler: adminController.reviewDocument.bind(adminController),
  });

  // Admin final worker verification approval / rejection
  fastify.patch('/admin/verifications/workers/:id', {
    preHandler: [verifyAuth, requireRoles(['ADMIN'])],
    handler: adminController.verifyWorker.bind(adminController),
  });

  // Admin platform overview metrics
  fastify.get('/admin/metrics', {
    preHandler: [verifyAuth, requireRoles(['ADMIN'])],
    handler: adminController.getPlatformMetrics.bind(adminController),
  });
}
