import { FastifyInstance } from 'fastify';
import { catalogController } from './catalog.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function catalogRoutes(fastify: FastifyInstance) {
  // Public category discovery
  fastify.get('/categories', catalogController.listCategories.bind(catalogController));
  fastify.get('/categories/:slug', catalogController.getCategoryBySlug.bind(catalogController));

  // Admin-only management
  fastify.post('/categories', {
    preHandler: [verifyAuth, requireRoles(['ADMIN'])],
  }, catalogController.createCategory.bind(catalogController));

  fastify.patch('/categories/:id', {
    preHandler: [verifyAuth, requireRoles(['ADMIN'])],
  }, catalogController.updateCategory.bind(catalogController));
}
