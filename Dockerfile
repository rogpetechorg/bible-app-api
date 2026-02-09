# Dockerfile simplificado para Easypanel
FROM node:20-slim AS base

# Instalar OpenSSL para Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Habilitar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ===== BUILDER =====
FROM base AS builder

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml* ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Gerar Prisma Client e build
RUN pnpm prisma generate && pnpm build

# ===== PRODUCTION =====
FROM base AS production

# Copiar package files
COPY package.json pnpm-lock.yaml* ./

# Instalar apenas dependências de produção
RUN pnpm install --prod --frozen-lockfile

# Copiar prisma schema
COPY prisma ./prisma

# Gerar Prisma Client
RUN pnpm prisma generate

# Copiar código compilado
COPY --from=builder /app/dist ./dist

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start
CMD ["node", "dist/server.js"]
