import { FastifyRequest, FastifyReply } from 'fastify';
import { updateCustomerProfileSchema } from './customer.schemas.js';
import { customerService } from './customer.service.js';
import { BadRequestError, UnauthorizedError } from '../../common/errors/app-error.js';

export class CustomerController {
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const profile = await customerService.getProfile(request.user.id);
    return reply.status(200).send({
      success: true,
      data: profile,
    });
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const parseResult = updateCustomerProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid profile data', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const updated = await customerService.updateProfile(request.user.id, parseResult.data);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async getSavedWorkers(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const list = await customerService.getSavedWorkers(request.user.id);
    return reply.status(200).send({
      success: true,
      data: list,
    });
  }

  async saveWorker(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const { workerId } = request.params as { workerId: string };
    const result = await customerService.saveWorker(request.user.id, workerId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async removeSavedWorker(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const { workerId } = request.params as { workerId: string };
    const result = await customerService.removeSavedWorker(request.user.id, workerId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}

export const customerController = new CustomerController();
