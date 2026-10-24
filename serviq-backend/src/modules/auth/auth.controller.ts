import { FastifyRequest, FastifyReply } from 'fastify';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
} from './auth.schemas.js';
import { authService } from './auth.service.js';
import { BadRequestError, UnauthorizedError } from '../../common/errors/app-error.js';

export class AuthController {
  async signup(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = signupSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid sign up information', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const clientIp = (request.headers['x-forwarded-for'] as string) || request.ip || '127.0.0.1';
    const { user, rawRefreshToken } = await authService.signup(parseResult.data, clientIp);

    const accessToken = await reply.jwtSign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        roles: [user.role.toUpperCase()],
      },
      { expiresIn: '15m' }
    );

    reply.setCookie('refreshToken', rawRefreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.status(201).send({
      success: true,
      data: {
        user,
        accessToken,
        expiresIn: 900,
      },
    });
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid login details', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const clientIp = (request.headers['x-forwarded-for'] as string) || request.ip || '127.0.0.1';
    const { user, rawRefreshToken } = await authService.login(parseResult.data, clientIp);

    const expiresIn = parseResult.data.rememberMe ? '30d' : '15m';

    const accessToken = await reply.jwtSign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        roles: [user.role.toUpperCase()],
      },
      { expiresIn }
    );

    reply.setCookie('refreshToken', rawRefreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = forgotPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid email format', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const clientIp = (request.headers['x-forwarded-for'] as string) || request.ip || '127.0.0.1';
    const result = await authService.forgotPassword(parseResult.data.email, clientIp);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = resetPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid reset parameters', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const clientIp = (request.headers['x-forwarded-for'] as string) || request.ip || '127.0.0.1';
    const result = await authService.resetPassword(parseResult.data.token, parseResult.data.newPassword, clientIp);

    return reply.status(200).send({
      success: true,
      data: result,
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
    const jwtUser = request.user as any;
    if (!jwtUser) {
      throw new UnauthorizedError('Not authenticated');
    }

    const user = authService.getUserById(jwtUser.id) || authService.getUserByEmail(jwtUser.email);
    if (!user) {
      return reply.status(200).send({
        success: true,
        data: { user: jwtUser },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          city: user.city,
          verificationStatus: user.verificationStatus,
          primarySkill: user.primarySkill,
          experienceYears: user.experienceYears,
          serviceArea: user.serviceArea,
          hourlyRate: user.hourlyRate,
        },
      },
    });
  }

  async getAuthEvents(request: FastifyRequest, reply: FastifyReply) {
    const events = authService.getAuthEvents();
    return reply.status(200).send({
      success: true,
      data: events,
    });
  }

  // --- OTP flow backward-compatibility ---
  async requestOtp(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = requestOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid phone number', 'VALIDATION_ERROR', parseResult.error.format());
    }
    const result = await authService.requestOtp(parseResult.data.phoneNumber);
    return reply.status(200).send({ success: true, data: result });
  }

  async verifyOtp(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = verifyOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid verification data', 'VALIDATION_ERROR', parseResult.error.format());
    }
    const { phoneNumber, otp, requestedRole } = parseResult.data;
    const { user, rawRefreshToken } = await authService.verifyOtp(phoneNumber, otp, requestedRole);

    const accessToken = await reply.jwtSign(
      { id: user.id, phoneNumber: user.phoneNumber, role: user.role, roles: [user.role.toUpperCase()] },
      { expiresIn: '15m' }
    );

    reply.setCookie('refreshToken', rawRefreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.status(200).send({
      success: true,
      data: { user, accessToken, expiresIn: 900 },
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
      { id: user.id, phoneNumber: user.phoneNumber, role: user.roles[0]?.toLowerCase() || 'customer', roles: user.roles },
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
      data: { user, accessToken, expiresIn: 900 },
    });
  }
}

export const authController = new AuthController();
