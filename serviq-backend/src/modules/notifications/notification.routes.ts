import { FastifyInstance } from 'fastify';
import { notificationController } from './notification.controller.js';
import { verifyAuth } from '../../common/middlewares/auth.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [verifyAuth] }, notificationController.listNotifications.bind(notificationController));
  fastify.patch('/:id/read', { preHandler: [verifyAuth] }, notificationController.markAsRead.bind(notificationController));
  fastify.post('/mark-all-read', { preHandler: [verifyAuth] }, notificationController.markAllAsRead.bind(notificationController));
}
