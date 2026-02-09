import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';

const deleteAccountSchema = z.object({
  password: z.string(),
  confirmDelete: z.boolean().refine((val) => val === true, {
    message: 'Confirme a exclusão',
  }),
});

// Auth middleware
async function authenticate(request: any, reply: any) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token não fornecido',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token inválido',
      },
    });
  }
}

export async function userRoutes(app: FastifyInstance) {
  const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
    : null;
  // Get current user
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        },
      });
    }

    // Get subscription
    const subscription = await app.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
    });

    // Get spiritual profile
    const spiritualProfile = await app.prisma.spiritualProfile.findUnique({
      where: { userId },
    });

    return {
      ...user,
      subscription: subscription ? {
        status: subscription.status,
        plan: subscription.plan.name,
        currentPeriodEnd: subscription.currentPeriodEnd,
      } : null,
      spiritualProfile: spiritualProfile?.profile || null,
    };
  });

  // Delete account (LGPD)
  app.delete('/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const body = deleteAccountSchema.parse(request.body);

    // Get user
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        },
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(body.password, user.passwordHash);

    if (!validPassword) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Senha incorreta',
        },
      });
    }

    // Cancel subscription if exists
    const subscription = await app.prisma.subscription.findFirst({
      where: { userId },
    });

    if (subscription) {
      if (stripe && subscription.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } catch (stripeError) {
          app.log.error({ err: stripeError }, 'Stripe cancel failed');
        }
      }

      await app.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled' },
      });
    }

    // Anonymize chat messages
    await app.prisma.chatMessage.updateMany({
      where: {
        thread: {
          userId,
        },
      },
      data: {
        content: '[Mensagem removida - conta excluída]',
      },
    });

    // Delete spiritual profile
    await app.prisma.spiritualProfile.deleteMany({
      where: { userId },
    });

    // Delete onboarding answers
    await app.prisma.onboardingAnswers.deleteMany({
      where: { userId },
    });

    // Soft delete user
    await app.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.com`,
        passwordHash: '[deleted]',
        deletedAt: new Date(),
      },
    });

    // Clear refresh token cookie
    reply.clearCookie('refreshToken', { path: '/' });

    return { message: 'Conta excluída com sucesso' };
  });
}
