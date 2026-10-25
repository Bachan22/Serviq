import { FastifyRequest, FastifyReply } from 'fastify';
import { notificationService } from './notification.service.js';

export class NotificationController {
  async listNotifications(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const result = await notificationService.getUserNotifications(userId);
    return reply.status(200).send({
      success: true,
      data: result.notifications,
      meta: { unreadCount: result.unreadCount },
    });
  }

  async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const updated = await notificationService.markAsRead(userId, id);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async markAllAsRead(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    await notificationService.markAllAsRead(userId);
    return reply.status(200).send({
      success: true,
      message: 'All notifications marked as read',
    });
  }
}

export const notificationController = new NotificationController();
