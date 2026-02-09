import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AIRouter } from '../../services/ai/ai-service';

const createThreadSchema = z.object({
  title: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
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

export async function chatRoutes(app: FastifyInstance) {
  const aiRouter = new AIRouter({
    openai: process.env.OPENAI_API_KEY!,
    anthropic: process.env.ANTHROPIC_API_KEY!,
  }, app.prisma);

  // Get all threads
  app.get('/threads', { preHandler: authenticate }, async (request) => {
    const userId = (request as any).user.userId;

    const threads = await app.prisma.chatThread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return {
      threads: threads.map((t: any) => ({
        id: t.id,
        title: t.title,
        lastMessageAt: t.updatedAt,
        messageCount: t._count.messages,
      })),
    };
  });

  // Create thread
  app.post('/threads', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const body = createThreadSchema.parse(request.body);

    const thread = await app.prisma.chatThread.create({
      data: {
        userId,
        title: body.title || 'Nova conversa',
      },
    });

    return reply.status(201).send(thread);
  });

  // Get thread messages
  app.get('/threads/:id/messages', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const { id } = request.params as { id: string };

    const thread = await app.prisma.chatThread.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Last 50 messages
        },
      },
    });

    if (!thread) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Thread não encontrada',
        },
      });
    }

    return {
      thread: {
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt,
      },
      messages: thread.messages,
    };
  });

  // Send message (with subscription check)
  app.post('/threads/:id/messages', { 
    preHandler: [authenticate, checkSubscription] 
  }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const { id } = request.params as { id: string };
    const body = sendMessageSchema.parse(request.body);

    // Check thread exists and belongs to user
    const thread = await app.prisma.chatThread.findFirst({
      where: { id, userId },
    });

    if (!thread) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Thread não encontrada',
        },
      });
    }

    // Check daily limit (20 messages)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const messageCount = await app.prisma.chatMessage.count({
      where: {
        thread: { userId },
        role: 'user',
        createdAt: { gte: today },
      },
    });

    if (messageCount >= 20) {
      return reply.status(429).send({
        error: {
          code: 'DAILY_LIMIT_REACHED',
          message: 'Limite diário de 20 mensagens atingido',
          details: {
            limit: 20,
            used: messageCount,
            resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });
    }

    // Get user profile
    const profile = await app.prisma.spiritualProfile.findUnique({
      where: { userId },
    });

    // Save user message
    await app.prisma.chatMessage.create({
      data: {
        threadId: id,
        role: 'user',
        content: body.content,
      },
    });

    // Get last 10 messages for context
    const recentMessages = await app.prisma.chatMessage.findMany({
      where: { threadId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const messages = recentMessages.reverse().map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Build system prompt
    const systemPrompt = profile?.profile ? 
      `Você é um assistente bíblico amigável e direto.

Regras:
1. Responda em português brasileiro
2. Seja conciso (máximo 3 parágrafos)
3. Inclua 1-2 referências bíblicas relevantes
4. Foque na aplicação prática
5. Tom: ${(profile.profile as any).tone || 'acolhedor'}
6. Profundidade: ${(profile.profile as any).depth || 'média'}

Contexto do usuário:
- Tradição: ${(profile.profile as any).tradition || 'cristã'}
- Objetivos: ${((profile.profile as any).goals || []).join(', ')}
- Temas de interesse: ${((profile.profile as any).topics || []).join(', ')}` :
      'Você é um assistente bíblico amigável e direto. Responda em português brasileiro, seja conciso e inclua referências bíblicas relevantes.';

    // Generate response with AI
    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages,
      { role: 'user' as const, content: body.content },
    ];

    let response;
    try {
      response = await aiRouter.generate('chat', {
        messages: aiMessages,
        maxTokens: 800,
        temperature: 0.7,
      });
    } catch (error) {
      console.error('AI generation failed, using fallback response', error);
      response = {
        content: 'Obrigado pela sua pergunta. Um caminho seguro para buscar direção espiritual e paz é levar tudo a Deus em oração e meditar na Palavra. "Não andeis ansiosos por coisa alguma..." (Filipenses 4:6-7) e "O Senhor é o meu pastor; nada me faltará" (Salmo 23:1). Se quiser, posso aprofundar com mais referências e aplicações práticas para o seu contexto.',
        usage: { input: 0, output: 0, total: 0 },
        model: 'fallback',
        provider: 'local',
      };
    }

    // Extract references (simple regex)
    const references = response.content.match(/\b([1-3]?\s*[A-Za-zÀ-ÿ]+\s+\d+:\d+(-\d+)?)\b/g) || [];

    // Save assistant message
    const assistantMessage = await app.prisma.chatMessage.create({
      data: {
        threadId: id,
        role: 'assistant',
        content: response.content,
        references: references.slice(0, 5), // Max 5 references
        tokensUsed: response.usage.total,
        provider: response.provider,
        model: response.model,
      },
    });

    // Update thread timestamp
    await app.prisma.chatThread.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return reply.status(201).send(assistantMessage);
  });

  // Get quota
  app.get('/quota', { preHandler: authenticate }, async (request) => {
    const userId = (request as any).user.userId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const used = await app.prisma.chatMessage.count({
      where: {
        thread: { userId },
        role: 'user',
        createdAt: { gte: today },
      },
    });

    return {
      dailyLimit: 20,
      used,
      remaining: Math.max(0, 20 - used),
      resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    };
  });
}
