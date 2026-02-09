# Production Dockerfile
FROM node:20-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable corepack and setup pnpm
RUN corepack enable

# ===== DEPENDENCIES =====
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ===== BUILDER =====
FROM base AS builder

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./

# Copy source code
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma Client and build
RUN pnpm prisma generate && \
    pnpm build

# ===== PRODUCTION =====
FROM base AS production

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN pnpm prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server.js"]
