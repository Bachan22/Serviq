import { FastifyRequest, FastifyReply } from 'fastify';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth.schemas.js';
import { authService } from './auth.service.js';
import { BadRequestError, UnauthorizedError } from '../../common/errors/app-error.js';

export class AuthController {
  async requestOtp(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = requestOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid input data', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const result = await authService.requestOtp(parseResult.data.phoneNumber);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async verifyOtp(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = verifyOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid verification data', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const { phoneNumber, otp, requestedRole } = parseResult.data;
    const { user, rawRefreshToken } = await authService.verifyOtp(phoneNumber, otp, requestedRole);

    // Sign short-lived JWT access token
    const accessToken = await reply.jwtSign(
      {
        id: user.id,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
      },
      { expiresIn: '15m' }
    );

    // Set refresh token in secure HttpOnly cookie
    reply.setCookie('refreshToken', rawRefreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return reply.status(200).send({
      success: true,
      data: {
        user,
        accessToken,
        expiresIn: 900, // 15 mins in seconds
      },
    });
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const cookieToken = request.cookies?.refreshToken;
    const bodyResult = refreshTokenSchema.safeParse(request.body);
    const token = cookieToken || (bodyResult.success ? bodyResult.data.refreshToken : undefined);

    if (!token) {
      throw new UnauthorizedError('Refresh token is required.');
    }

    const { user, newRawRefreshToken } = await authService.rotateRefreshToken(token);

    const accessToken = await reply.jwtSign(
      {
        id: user.id,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
      },
      { expiresIn: '15m' }
    );

    reply.setCookie('refreshToken', newRawRefreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.status(200).send({
      success: true,
      data: {
        user,
        accessToken,
        expiresIn: 900,
      },
    });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const cookieToken = request.cookies?.refreshToken;
    await authService.logout(cookieToken);

    reply.clearCookie('refreshToken', {
      path: '/api/v1/auth',
    });

    return reply.status(200).send({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      success: true,
      data: {
        user: request.user,
      },
    });
  }
}

export const authController = new AuthController();
