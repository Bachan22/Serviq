import { FastifyRequest, FastifyReply } from 'fastify';
import { createAddressSchema, updateAddressSchema } from './address.schemas';
import { addressService } from './address.service';
import { BadRequestError, UnauthorizedError } from '../../common/errors/app-error';

export class AddressController {
  async listAddresses(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const list = await addressService.listAddresses(request.user.id);

    return reply.status(200).send({
      success: true,
      data: list,
    });
  }

  async createAddress(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const parseResult = createAddressSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid address data', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const created = await addressService.createAddress(request.user.id, parseResult.data);
    return reply.status(201).send({
      success: true,
      data: created,
    });
  }

  async updateAddress(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const { id } = request.params as { id: string };
    const parseResult = updateAddressSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid address data', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const updated = await addressService.updateAddress(request.user.id, id, parseResult.data);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async deleteAddress(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const { id } = request.params as { id: string };
    const result = await addressService.deleteAddress(request.user.id, id);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async setDefaultAddress(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError();
    const { id } = request.params as { id: string };
    const updated = await addressService.setDefaultAddress(request.user.id, id);

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }
}

export const addressController = new AddressController();
