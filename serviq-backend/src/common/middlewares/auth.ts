import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';

export interface AuthUserPayload {
  id: string;
  phoneNumber?: string;
  email?: string;
  role?: string;
  fullName?: string;
  roles: string[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}

/**
 * Middleware hook to verify JWT access token
 */
export async function verifyAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header.');
    }

    const token = authHeader.substring(7);
    const decoded = await request.jwtVerify<AuthUserPayload>();
    request.user = decoded;
  } catch (err: any) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired authentication token.');
  }
}

/**
 * Higher-order middleware hook to enforce role-based access control (RBAC)
 */
export function requireRoles(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Ensure verifyAuth ran first
    if (!request.user) {
      await verifyAuth(request, reply);
    }

    const userRoles = request.user?.roles || [];
    const hasRole = userRoles.some((role: string) => allowedRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenError(
        `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}].`
      );
    }
  };
}
