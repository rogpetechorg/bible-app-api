import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AIRouter } from '../../services/ai/ai-service';

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

// Check subscription middleware
async function checkSubscription(request: any, reply: any) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const userId = request.user.userId;
  
  const subscription = await request.server.prisma.subscription.findFirst({
    where: {
      userId,
      status: 'active',
      currentPeriodEnd: { gt: new Date() },
    },
  });

  if (!subscription) {
    return reply.status(403).send({
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Assinatura necessária',
      },
    });
  }

  request.subscription = subscription;
}

export async function devotionalRoutes(app: FastifyInstance) {
  const aiRouter = new AIRouter({
    openai: process.env.OPENAI_API_KEY!,
    anthropic: process.env.ANTHROPIC_API_KEY!,
  }, app.prisma);

  // Get today's devotional (does not auto-generate)
  app.get('/today', { preHandler: [authenticate, checkSubscription] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if devotional exists for today
    let devotional = await app.prisma.devotional.findFirst({
      where: {
        userId,
        date: today,
        isRegenerated: false,
      },
    });

    const regeneratedCount = await app.prisma.devotional.count({
      where: {
        userId,
        date: today,
        isRegenerated: true,
      },
    });

    const baseCount = devotional ? 1 : 0;

    return {
      devotional,
      canGenerate: baseCount === 0,
      canRegenerate: regeneratedCount === 0,
      stats: {
        baseToday: baseCount,
        regeneratedToday: regeneratedCount,
        baseLimit: 1,
        regenerateLimit: 1,
      },
    };
  });

  // Generate devotional (base once per day, plus 1 regeneration)
  app.post('/generate', { preHandler: [authenticate, checkSubscription] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseDevotional = await app.prisma.devotional.findFirst({
      where: {
        userId,
        date: today,
        isRegenerated: false,
      },
    });

    // Check if already regenerated today
    const regeneratedCount = await app.prisma.devotional.count({
      where: {
        userId,
        date: today,
        isRegenerated: true,
      },
    });

    if (baseDevotional && regeneratedCount >= 1) {
      return reply.status(429).send({
        error: {
          code: 'REGENERATE_LIMIT_REACHED',
          message: 'Você já gerou um devocional extra hoje',
          details: {
            limit: 1,
            used: regeneratedCount,
            resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });
    }

    const devotional = await generateDevotional(
      app,
      aiRouter,
      userId,
      today,
      !!baseDevotional
    );

    return reply.status(201).send({
      ...devotional,
      canRegenerate: baseDevotional ? false : true,
    });
  });

  // Get history
  app.get('/history', { preHandler: [authenticate, checkSubscription] }, async (request) => {
    const userId = (request as any).user.userId;
    const { limit = '7', offset = '0' } = request.query as { limit?: string; offset?: string };

    const take = Math.min(parseInt(limit), 30);
    const skip = parseInt(offset);

    const [items, total] = await Promise.all([
      app.prisma.devotional.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take,
        skip,
        select: {
          id: true,
          date: true,
          title: true,
          reference: true,
        },
      }),
      app.prisma.devotional.count({
        where: { userId },
      }),
    ]);

    return {
      items,
      total,
      hasMore: skip + take < total,
    };
  });
}

async function generateDevotional(
  app: FastifyInstance,
  aiRouter: AIRouter,
  userId: string,
  date: Date,
  isRegenerated: boolean
) {
  // Get user profile
  const profile = await app.prisma.spiritualProfile.findUnique({
    where: { userId },
  });

  const profileData = profile?.profile as any || {};

  // Build prompt
  const prompt = `Você é um escritor devocional cristão experiente, criando conteúdo para o aplicativo bible.hyno.io.

Sua tarefa: Criar um devocional diário personalizado.

ESTRUTURA OBRIGATÓRIA (JSON):
{
  "title": "Título inspirador (máx 60 chars)",
  "reflection": "3-4 parágrafos de reflexão bíblica",
  "application": "Aplicação prática específica",
  "prayer": "Oração curta e pessoal",
  "reference": "Referência bíblica principal"
}

DIRETRIZES:
- Tom: ${profileData.tone || 'acolhedor'}
- Profundidade: ${profileData.depth || 'média'}
- Incluir referências bíblicas: ${profileData.verseStyle || 'frequente'}

PERFIL DO USUÁRIO:
- Tradição: ${profileData.tradition || 'cristã'}
- Objetivos espirituais: ${(profileData.goals || []).join(', ')}
- Temas de interesse: ${(profileData.topics || []).join(', ')}
- Horário preferido: ${profileData.devotionalTimePreference || 'flexível'}

IMPORTANTE:
- Nunca seja dogmático sobre denominações
- Foque em princípios bíblicos universais
- Seja acolhedor e encorajador
- Evite jargão teológico excessivo`;

  // Generate with AI
  let response;
  let content;
  try {
    response = await aiRouter.generate('devotional', {
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
      temperature: 0.8,
      jsonMode: true,
    });

    content = JSON.parse(response.content);
  } catch (error) {
    console.error('AI devotional failed, using fallback', error);
    response = {
      usage: { input: 0, output: 0, total: 0 },
      provider: 'local',
      model: 'fallback',
    } as any;
    content = {
      title: 'Renovando a mente na presença de Deus',
      reflection:
        'Mesmo nos dias mais acelerados, Deus nos convida a renovar a mente e descansar na Sua fidelidade. Em Romanos 12:2, somos chamados a não nos conformarmos com este século, mas a sermos transformados pela renovação da nossa mente. Quando entregamos nossos pensamentos a Deus, recebemos clareza para seguir com paz e propósito.',
      application:
        'Separe alguns minutos hoje para ler Romanos 12:2, ore pedindo direção e escreva uma decisão prática que você pode tomar para alinhar sua rotina com os valores do Reino.',
      prayer:
        'Senhor, renova minha mente e ensina-me a viver em Teus caminhos. Que eu encontre direção e paz ao meditar na Tua Palavra. Em nome de Jesus, amém.',
      reference: 'Romanos 12:2',
    };
  }

  // Save to database
  const devotional = await app.prisma.devotional.create({
    data: {
      userId,
      date,
      title: content.title,
      reflection: content.reflection,
      application: content.application,
      prayer: content.prayer,
      reference: content.reference,
      isRegenerated,
      tokensUsed: response.usage.total,
      provider: response.provider,
      model: response.model,
    },
  });

  return devotional;
}
