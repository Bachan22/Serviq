import { FastifyRequest, FastifyReply } from 'fastify';
import { adminService } from './admin.service';
import {
  submitWorkerDocumentSchema,
  reviewWorkerDocumentSchema,
  verifyWorkerProfileSchema,
} from './admin.schemas';

export class AdminController {
  async submitDocument(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const input = submitWorkerDocumentSchema.parse(request.body);
    const doc = await adminService.submitDocument(workerId, input);
    return reply.status(201).send({
      success: true,
      data: doc,
    });
  }

  async getMyDocuments(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const docs = await adminService.getWorkerDocuments(workerId);
    return reply.status(200).send({
      success: true,
      data: docs,
    });
  }

  async listPendingVerifications(request: FastifyRequest, reply: FastifyReply) {
    const pending = await adminService.listPendingVerifications();
    return reply.status(200).send({
      success: true,
      data: pending,
    });
  }

  async reviewDocument(request: FastifyRequest, reply: FastifyReply) {
    const adminId = request.user.id;
    const { id } = request.params as { id: string };
    const input = reviewWorkerDocumentSchema.parse(request.body);
    const updated = await adminService.reviewDocument(adminId, id, input);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async verifyWorker(request: FastifyRequest, reply: FastifyReply) {
    const adminId = request.user.id;
    const { id } = request.params as { id: string };
    const input = verifyWorkerProfileSchema.parse(request.body);
    const updated = await adminService.verifyWorker(adminId, id, input);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async getPlatformMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = await adminService.getPlatformMetrics();
    return reply.status(200).send({
      success: true,
      data: metrics,
    });
  }
}

export const adminController = new AdminController();
