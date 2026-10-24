import { FastifyRequest, FastifyReply } from 'fastify';
import { updateCustomerProfileSchema } from './customer.schemas';
import { customerService } from './customer.service';
import { BadRequestError, UnauthorizedError } from '../../common/errors/app-error';

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
}

export const customerController = new CustomerController();
