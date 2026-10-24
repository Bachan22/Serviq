import { FastifyInstance } from 'fastify';
import { addressController } from './address.controller';
import { verifyAuth, requireRoles } from '../../common/middlewares/auth';

export async function addressRoutes(fastify: FastifyInstance) {
  fastify.get('/addresses', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, addressController.listAddresses.bind(addressController));

  fastify.post('/addresses', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, addressController.createAddress.bind(addressController));

  fastify.put('/addresses/:id', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, addressController.updateAddress.bind(addressController));

  fastify.delete('/addresses/:id', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, addressController.deleteAddress.bind(addressController));

  fastify.patch('/addresses/:id/default', {
    preHandler: [verifyAuth, requireRoles(['CUSTOMER'])],
  }, addressController.setDefaultAddress.bind(addressController));
}
