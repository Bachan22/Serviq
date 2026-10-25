import { FastifyRequest, FastifyReply } from 'fastify';
import { messagesService } from './messages.service.js';
import { sendMessageSchema, getOrCreateConversationSchema } from './messages.schemas.js';

export class MessagesController {
  async listConversations(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const conversations = await messagesService.listUserConversations(userId);
    return reply.status(200).send({
      success: true,
      data: conversations,
    });
  }

  async getOrCreateConversation(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const { bookingId } = getOrCreateConversationSchema.parse(request.body);
    const conv = await messagesService.getOrCreateConversation(userId, bookingId);
    return reply.status(200).send({
      success: true,
      data: conv,
    });
  }

  async getConversation(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const result = await messagesService.getConversation(userId, id);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const { body } = sendMessageSchema.parse(request.body);
    const message = await messagesService.sendMessage(userId, id, body);
    return reply.status(201).send({
      success: true,
      data: message,
    });
  }
}

export const messagesController = new MessagesController();
