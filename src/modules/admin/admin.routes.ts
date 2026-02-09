import { FastifyInstance } from 'fastify';

import jwt from 'jsonwebtoken';

// Auth middleware with admin check
async function authenticateAdmin(request: any, reply: any) {
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
    
    if (decoded.role !== 'ADMIN') {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores',
        },
      });
    }
    
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

export async function adminRoutes(app: FastifyInstance) {
  // Get dashboard stats
  app.get('/dashboard', { preHandler: authenticateAdmin }, async () => {
    const [
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      aiUsage,
    ] = await Promise.all([
      app.prisma.user.count({
        where: { deletedAt: null },
      }),
      app.prisma.subscription.count({
        where: {
          status: 'active',
          currentPeriodEnd: { gt: new Date() },
        },
      }),
      app.prisma.subscription.aggregate({
        where: { status: 'active' },
        _sum: {
          plan: {
            select: { amount: true },
          },
        },
      }),
      app.prisma.aIUsageLog.aggregate({
        _sum: { costUsd: true },
      }),
    ]);

    return {
      totalUsers,
      activeSubscriptions,
      mrr: totalRevenue._sum || 0,
      aiCost: aiUsage._sum?.costUsd || 0,
    };
  });

  // List users
  app.get('/users', { preHandler: authenticateAdmin }, async (request) => {
    const { page = '1', limit = '20', status } = request.query as any;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { deletedAt: null };
    
    if (status) {
      where.subscription = { status };
    }

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          subscription: {
            select: {
              status: true,
              plan: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      app.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  });

  // List subscriptions
  app.get('/subscriptions', { preHandler: authenticateAdmin }, async (request) => {
    const { status } = request.query as any;

    const where: any = {};
    if (status) where.status = status;

    const subscriptions = await app.prisma.subscription.findMany({
      where,
      include: {
        user: {
          select: { email: true },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = await app.prisma.subscription.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    return {
      subscriptions,
      summary,
    };
  });

  // AI usage logs
  app.get('/ai-usage', { preHandler: authenticateAdmin }, async (request) => {
    const { startDate, endDate } = request.query as any;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [
      summary,
      byProvider,
      byDay,
    ] = await Promise.all([
      app.prisma.aIUsageLog.aggregate({
        where,
        _sum: {
          tokensInput: true,
          tokensOutput: true,
          costUsd: true,
        },
        _count: { id: true },
      }),
      app.prisma.aIUsageLog.groupBy({
        where,
        by: ['provider'],
        _sum: {
          tokensInput: true,
          tokensOutput: true,
          costUsd: true,
        },
        _count: { id: true },
      }),
      app.prisma.aIUsageLog.groupBy({
        where,
        by: ['createdAt'],
        _sum: {
          costUsd: true,
        },
        _count: { id: true },
      }),
    ]);

    return {
      summary: {
        totalRequests: summary._count?.id || 0,
        totalTokensInput: summary._sum?.tokensInput || 0,
        totalTokensOutput: summary._sum?.tokensOutput || 0,
        totalCost: summary._sum?.costUsd || 0,
      },
      byProvider,
      byDay: byDay.slice(-30), // Last 30 days
    };
  });
}
