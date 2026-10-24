import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';
import { verifyAuth } from '../../common/middlewares/auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/request-otp', authController.requestOtp.bind(authController));
  fastify.post('/verify-otp', authController.verifyOtp.bind(authController));
  fastify.post('/refresh', authController.refreshToken.bind(authController));
  fastify.post('/logout', authController.logout.bind(authController));
  fastify.get('/me', { preHandler: [verifyAuth] }, authController.getMe.bind(authController));
}
