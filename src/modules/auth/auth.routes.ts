import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'Você deve aceitar os termos',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // Signup
  app.post('/signup', async (request, reply) => {
    const body = signupSchema.parse(request.body);

    // Check if user exists
    const existingUser = await app.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return reply.status(409).send({
        error: {
          code: 'USER_EXISTS',
          message: 'Email já cadastrado',
        },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Create user
    const user = await app.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken();

    // Save refresh token
    await app.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || '',
      },
    });

    // Set refresh token cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return reply.status(201).send({
      user,
      accessToken,
    });
  });

  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    // Find user
    const user = await app.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas',
        },
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(body.password, user.passwordHash);

    if (!validPassword) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas',
        },
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken();

    // Save refresh token
    await app.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || '',
      },
    });

    // Set refresh token cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
    };
  });

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token não encontrado',
        },
      });
    }

    // Find session
    const session = await app.prisma.session.findFirst({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token inválido',
        },
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(
      session.user.id,
      session.user.email,
      session.user.role
    );

    return { accessToken };
  });

  // Logout
  app.post('/logout', async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;

    if (refreshToken) {
      // Revoke session
      await app.prisma.session.updateMany({
        where: {
          refreshTokenHash: hashToken(refreshToken),
        },
        data: {
          revokedAt: new Date(),
        },
      });

      // Clear cookie
      reply.clearCookie('refreshToken', { path: '/' });
    }

    return { message: 'Logout realizado com sucesso' };
  });
}

function generateAccessToken(userId: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key-min-32-characters-long';
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  return jwt.sign(
    { userId, email, role },
    secret,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}

function hashToken(token: string): string {
  return jwt.sign(token, process.env.JWT_SECRET!).slice(0, 64);
}
