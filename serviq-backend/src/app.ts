import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { AppError } from './common/errors/app-error.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { customerRoutes } from './modules/customers/customer.routes.js';
import { addressRoutes } from './modules/addresses/address.routes.js';
import { discoveryRoutes } from './modules/discovery/discovery.routes.js';
import { workerRoutes } from './modules/workers/worker.routes.js';
import { bookingRoutes } from './modules/bookings/booking.routes.js';
import { negotiationRoutes } from './modules/negotiations/negotiation.routes.js';
import { walletRoutes } from './modules/wallets/wallet.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { reviewRoutes } from './modules/reviews/review.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { BusinessRules } from './config/business-rules.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  });

  // CORS setup
  app.register(cors, {
    origin: [env.CORS_ORIGIN, 'http://localhost:5173'],
    credentials: true,
  });

  // Cookies for secure refresh tokens
  app.register(cookie);

  // JWT setup
  app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  // Rate limiting setup
  app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Global Health & Info Route
  app.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
  }));

  // Public Configuration Endpoint (exposing configurable non-sensitive rules to frontend)
  app.get('/api/v1/config/business-rules', async () => ({
    success: true,
    data: {
      commissionRatePct: BusinessRules.commission.serviceLaborRatePct,
      cancellationTripFee: BusinessRules.cancellation.tripFeeAmount,
      cancellationGracePeriodMins: BusinessRules.cancellation.gracePeriodMinutes,
      maxNegotiationRounds: BusinessRules.negotiation.maxRoundsPerParty,
      offerExpiryMinutes: BusinessRules.negotiation.offerExpiryMinutes,
    },
  }));

  // Register Modules
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(catalogRoutes, { prefix: '/api/v1' });
  app.register(customerRoutes, { prefix: '/api/v1/customers' });
  app.register(addressRoutes, { prefix: '/api/v1' });
  app.register(discoveryRoutes, { prefix: '/api/v1/workers' });
  app.register(workerRoutes, { prefix: '/api/v1/workers' });
  app.register(bookingRoutes, { prefix: '/api/v1/bookings' });
  app.register(negotiationRoutes, { prefix: '/api/v1' });
  app.register(walletRoutes, { prefix: '/api/v1/wallets' });
  app.register(paymentRoutes, { prefix: '/api/v1/payments' });
  app.register(reviewRoutes, { prefix: '/api/v1' });
  app.register(adminRoutes, { prefix: '/api/v1' });

  // Standardized Global Error Handler
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    const timestamp = new Date().toISOString();

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          details: error.details,
        },
        timestamp,
        requestId,
      });
    }

    // Fastify native schema validation error
    if (error.validation) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request payload validation failed.',
          details: error.validation,
        },
        timestamp,
        requestId,
      });
    }

    // Fastify rate limit error
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
        },
        timestamp,
        requestId,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request payload or query validation failed.',
          details: error.format(),
        },
        timestamp,
        requestId,
      });
    }

    // Unhandled exception logging
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected internal error occurred.',
        details: env.NODE_ENV !== 'production' ? (error.stack || error.message) : undefined,
      },
      timestamp,
      requestId,
    });
  });

  return app;
}
