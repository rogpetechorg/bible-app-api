import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { onboardingRoutes } from './modules/onboarding/onboarding.routes.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import { devotionalRoutes } from './modules/devotional/devotional.routes.js';
import { readingRoutes } from './modules/reading/reading.routes.js';
import { billingRoutes } from './modules/billing/billing.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { errorHandler } from './middleware/error-handler.js';

dotenv.config();

const prisma = new PrismaClient();

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  await app.register(cookie, {
    secret: process.env.JWT_SECRET || 'cookie-secret',
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry in ${context.after}`,
    }),
  });

  // Decorate with prisma
  app.decorate('prisma', prisma);

  // Health check
  app.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
      },
    };
  });

  // API Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  await app.register(chatRoutes, { prefix: '/api/v1/chat' });
  await app.register(devotionalRoutes, { prefix: '/api/v1/devotional' });
  await app.register(readingRoutes, { prefix: '/api/v1/reading' });
  await app.register(billingRoutes, { prefix: '/api/v1/billing' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  return app;
}

async function start() {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3001');

    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API running on http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Only run if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
