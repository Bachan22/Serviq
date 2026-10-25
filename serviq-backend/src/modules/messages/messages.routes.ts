import { FastifyInstance } from 'fastify';
import { messagesController } from './messages.controller.js';
import { verifyAuth } from '../../common/middlewares/auth.js';

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/conversations',
    { preHandler: [verifyAuth] },
    messagesController.listConversations.bind(messagesController)
  );

  fastify.post(
    '/conversations',
    { preHandler: [verifyAuth] },
    messagesController.getOrCreateConversation.bind(messagesController)
  );

  fastify.get(
    '/conversations/:id',
    { preHandler: [verifyAuth] },
    messagesController.getConversation.bind(messagesController)
  );

  fastify.post(
    '/conversations/:id/messages',
    { preHandler: [verifyAuth] },
    messagesController.sendMessage.bind(messagesController)
  );
}
