import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // Zod validation errors
  if (error.code === 'FST_ERR_VALIDATION') {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: error.message,
      },
    });
  }

  // Rate limit
  if (error.code === 'FST_ERR_RATE_LIMIT') {
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMITED',
        message: 'Limite de requisições excedido',
        details: error.message,
      },
    });
  }

  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE') {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Não autenticado',
      },
    });
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Erro interno do servidor' 
    : error.message;

  return reply.status(statusCode).send({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}
