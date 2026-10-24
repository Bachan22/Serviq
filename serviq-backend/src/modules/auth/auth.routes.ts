import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';
import { verifyAuth } from '../../common/middlewares/auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  // New Email/Password Auth System
  fastify.post('/signup', authController.signup.bind(authController));
  fastify.post('/login', authController.login.bind(authController));
  fastify.post('/forgot-password', authController.forgotPassword.bind(authController));
  fastify.post('/reset-password', authController.resetPassword.bind(authController));
  fastify.post('/logout', authController.logout.bind(authController));
  fastify.get('/me', { preHandler: [verifyAuth] }, authController.getMe.bind(authController));
  fastify.get('/events', authController.getAuthEvents.bind(authController));

  // Legacy OTP flow support
  fastify.post('/request-otp', authController.requestOtp.bind(authController));
  fastify.post('/verify-otp', authController.verifyOtp.bind(authController));
  fastify.post('/refresh', authController.refreshToken.bind(authController));
}
