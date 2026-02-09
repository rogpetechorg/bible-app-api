import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AIRouter } from '../../services/ai/ai-service';

const onboardingAnswersSchema = z.object({
  answers: z.object({
    tradition: z.string(),
    approach: z.string(),
    goal: z.string(),
    messageLength: z.string(),
    tone: z.string(),
    verseFrequency: z.string(),
    devotionalTime: z.string(),
    topics: z.array(z.string()),
    includePrayer: z.boolean(),
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

export async function onboardingRoutes(app: FastifyInstance) {
  const aiRouter = new AIRouter({
    openai: process.env.OPENAI_API_KEY!,
    anthropic: process.env.ANTHROPIC_API_KEY!,
  }, app.prisma);

  // Save onboarding answers
  app.post('/answers', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const body = onboardingAnswersSchema.parse(request.body);

    // Check if already exists
    const existing = await app.prisma.onboardingAnswers.findUnique({
      where: { userId },
    });

    if (existing) {
      // Update
      const updated = await app.prisma.onboardingAnswers.update({
        where: { userId },
        data: { answers: body.answers },
      });
      return updated;
    }

    // Create
    const answers = await app.prisma.onboardingAnswers.create({
      data: {
        userId,
        answers: body.answers,
      },
    });

    return reply.status(201).send(answers);
  });

  // Generate spiritual profile
  app.post('/generate-profile', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;

    // Get answers
    const onboardingAnswers = await app.prisma.onboardingAnswers.findUnique({
      where: { userId },
    });

    if (!onboardingAnswers) {
      return reply.status(400).send({
        error: {
          code: 'NO_ANSWERS',
          message: 'Respostas do onboarding não encontradas',
        },
      });
    }

    // Generate profile with AI
    const prompt = `Você é um assistente espiritual que analisa respostas de onboarding para criar um perfil espiritual personalizado.

Analise as respostas e gere um perfil JSON completo.

RESPOSTAS DO USUÁRIO:
${JSON.stringify(onboardingAnswers.answers, null, 2)}

GERE O SEGUINTE JSON:
{
  "tradition": "tradição identificada",
  "tone": "tom de comunicação ideal",
  "depth": "profundidade do conteúdo",
  "goals": ["objetivos espirituais identificados"],
  "verseStyle": "frequência de referências",
  "topics": ["temas de interesse"],
  "devotionalTimePreference": "horário preferido",
  "languageStyle": "estilo linguístico",
  "systemPrompt": "prompt completo para futuras interações"
}

DIRETRIZES:
- Seja perspicaz nas inferências
- Capture nuances das respostas
- Crie systemPrompt detalhado
- Mantenha neutralidade denominacional`;

    const response = await aiRouter.generate('onboarding', {
      messages: [
        { role: 'user', content: prompt },
      ],
      maxTokens: 1500,
      temperature: 0.6,
      jsonMode: true,
    });

    const profile = JSON.parse(response.content);

    // Save profile
    const savedProfile = await app.prisma.spiritualProfile.upsert({
      where: { userId },
      create: {
        userId,
        profile,
      },
      update: {
        profile,
      },
    });

    return reply.status(201).send({
      profile: savedProfile.profile,
    });
  });

  // Get profile
  app.get('/profile', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;

    const profile = await app.prisma.spiritualProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Perfil não encontrado',
        },
      });
    }

    return { profile: profile.profile };
  });
}
