import { FastifyInstance } from 'fastify';
import { customerController } from './customer.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function customerRoutes(fastify: FastifyInstance) {
  fastify.get('/me', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, customerController.getMe.bind(customerController));

  fastify.put('/me', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, customerController.updateMe.bind(customerController));
}
