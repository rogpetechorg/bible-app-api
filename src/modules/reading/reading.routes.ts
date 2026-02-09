import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AIRouter } from '../../services/ai/ai-service.js';

// Bible books data
const bibleBooks = [
  { id: 'genesis', name: 'Gênesis', testament: 'old', chapters: 50 },
  { id: 'exodo', name: 'Êxodo', testament: 'old', chapters: 40 },
  { id: 'levitico', name: 'Levítico', testament: 'old', chapters: 27 },
  { id: 'numeros', name: 'Números', testament: 'old', chapters: 36 },
  { id: 'deuteronomio', name: 'Deuteronômio', testament: 'old', chapters: 34 },
  { id: 'josue', name: 'Josué', testament: 'old', chapters: 24 },
  { id: 'juizes', name: 'Juízes', testament: 'old', chapters: 21 },
  { id: 'rute', name: 'Rute', testament: 'old', chapters: 4 },
  { id: '1samuel', name: '1 Samuel', testament: 'old', chapters: 31 },
  { id: '2samuel', name: '2 Samuel', testament: 'old', chapters: 24 },
  { id: '1reis', name: '1 Reis', testament: 'old', chapters: 22 },
  { id: '2reis', name: '2 Reis', testament: 'old', chapters: 25 },
  { id: '1cronicas', name: '1 Crônicas', testament: 'old', chapters: 29 },
  { id: '2cronicas', name: '2 Crônicas', testament: 'old', chapters: 36 },
  { id: 'esdras', name: 'Esdras', testament: 'old', chapters: 10 },
  { id: 'neemias', name: 'Neemias', testament: 'old', chapters: 13 },
  { id: 'ester', name: 'Ester', testament: 'old', chapters: 10 },
  { id: 'jo', name: 'Jó', testament: 'old', chapters: 42 },
  { id: 'salmos', name: 'Salmos', testament: 'old', chapters: 150 },
  { id: 'proverbios', name: 'Provérbios', testament: 'old', chapters: 31 },
  { id: 'eclesiastes', name: 'Eclesiastes', testament: 'old', chapters: 12 },
  { id: 'cantares', name: 'Cantares', testament: 'old', chapters: 8 },
  { id: 'isaias', name: 'Isaías', testament: 'old', chapters: 66 },
  { id: 'jeremias', name: 'Jeremias', testament: 'old', chapters: 52 },
  { id: 'lamentacoes', name: 'Lamentações', testament: 'old', chapters: 5 },
  { id: 'ezequiel', name: 'Ezequiel', testament: 'old', chapters: 48 },
  { id: 'daniel', name: 'Daniel', testament: 'old', chapters: 12 },
  { id: 'oseias', name: 'Oséias', testament: 'old', chapters: 14 },
  { id: 'joel', name: 'Joel', testament: 'old', chapters: 3 },
  { id: 'amos', name: 'Amós', testament: 'old', chapters: 9 },
  { id: 'obadias', name: 'Obadias', testament: 'old', chapters: 1 },
  { id: 'jonas', name: 'Jonas', testament: 'old', chapters: 4 },
  { id: 'miqueias', name: 'Miquéias', testament: 'old', chapters: 7 },
  { id: 'naum', name: 'Naum', testament: 'old', chapters: 3 },
  { id: 'habacuque', name: 'Habacuque', testament: 'old', chapters: 3 },
  { id: 'sofonias', name: 'Sofonias', testament: 'old', chapters: 3 },
  { id: 'ageu', name: 'Ageu', testament: 'old', chapters: 2 },
  { id: 'zacarias', name: 'Zacarias', testament: 'old', chapters: 14 },
  { id: 'malaquias', name: 'Malaquias', testament: 'old', chapters: 4 },
  { id: 'mateus', name: 'Mateus', testament: 'new', chapters: 28 },
  { id: 'marcos', name: 'Marcos', testament: 'new', chapters: 16 },
  { id: 'lucas', name: 'Lucas', testament: 'new', chapters: 24 },
  { id: 'joao', name: 'João', testament: 'new', chapters: 21 },
  { id: 'atos', name: 'Atos', testament: 'new', chapters: 28 },
  { id: 'romanos', name: 'Romanos', testament: 'new', chapters: 16 },
  { id: '1corintios', name: '1 Coríntios', testament: 'new', chapters: 16 },
  { id: '2corintios', name: '2 Coríntios', testament: 'new', chapters: 13 },
  { id: 'galatas', name: 'Gálatas', testament: 'new', chapters: 6 },
  { id: 'efesios', name: 'Efésios', testament: 'new', chapters: 6 },
  { id: 'filipenses', name: 'Filipenses', testament: 'new', chapters: 4 },
  { id: 'colossenses', name: 'Colossenses', testament: 'new', chapters: 4 },
  { id: '1tessalonicenses', name: '1 Tessalonicenses', testament: 'new', chapters: 5 },
  { id: '2tessalonicenses', name: '2 Tessalonicenses', testament: 'new', chapters: 3 },
  { id: '1timoteo', name: '1 Timóteo', testament: 'new', chapters: 6 },
  { id: '2timoteo', name: '2 Timóteo', testament: 'new', chapters: 4 },
  { id: 'tito', name: 'Tito', testament: 'new', chapters: 3 },
  { id: 'filemom', name: 'Filemom', testament: 'new', chapters: 1 },
  { id: 'hebreus', name: 'Hebreus', testament: 'new', chapters: 13 },
  { id: 'tiago', name: 'Tiago', testament: 'new', chapters: 5 },
  { id: '1pedro', name: '1 Pedro', testament: 'new', chapters: 5 },
  { id: '2pedro', name: '2 Pedro', testament: 'new', chapters: 3 },
  { id: '1joao', name: '1 João', testament: 'new', chapters: 5 },
  { id: '2joao', name: '2 João', testament: 'new', chapters: 1 },
  { id: '3joao', name: '3 João', testament: 'new', chapters: 1 },
  { id: 'judas', name: 'Judas', testament: 'new', chapters: 1 },
  { id: 'apocalipse', name: 'Apocalipse', testament: 'new', chapters: 22 },
];

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

export async function readingRoutes(app: FastifyInstance) {
  const aiRouter = new AIRouter({
    openai: process.env.OPENAI_API_KEY!,
    anthropic: process.env.ANTHROPIC_API_KEY!,
  }, app.prisma);

  // Get all books
  app.get('/books', { preHandler: authenticate }, async () => {
    return { books: bibleBooks };
  });

  // Get chapter content
  app.get('/books/:bookId/chapters/:chapter', { 
    preHandler: [authenticate, checkSubscription] 
  }, async (request, reply) => {
    const { bookId, chapter } = request.params as { bookId: string; chapter: string };
    const chapterNum = parseInt(chapter);

    // Find book
    const book = bibleBooks.find(b => b.id === bookId);
    if (!book) {
      return reply.status(404).send({
        error: {
          code: 'BOOK_NOT_FOUND',
          message: 'Livro não encontrado',
        },
      });
    }

    // Validate chapter
    if (chapterNum < 1 || chapterNum > book.chapters) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_CHAPTER',
          message: 'Capítulo inválido',
        },
      });
    }

    // Generate content with AI
    const prompt = `Crie um guia de estudo bíblico para ${book.name} ${chapterNum}.

ESTRUTURA OBRIGATÓRIA (JSON):
{
  "summary": "Resumo do capítulo em 2-3 parágrafos",
  "context": "Contexto histórico e literário breve",
  "learnings": ["3 aprendizados principais"],
  "questions": ["2 perguntas reflexivas"],
  "keyVerses": ["2-3 referências de versículos-chave"],
  "estimatedTime": "Tempo estimado de leitura (ex: 10 minutos)"
}

DIRETRIZES:
- Foque nos princípios principais
- Seja objetivo e claro
- Evite controvérsias teológicas
- Inclua aplicação prática`;

    const response = await aiRouter.generate('reading', {
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000,
      temperature: 0.7,
      jsonMode: true,
    });

    const content = JSON.parse(response.content);

    return {
      book: book.name,
      chapter: chapterNum,
      ...content,
    };
  });
}
