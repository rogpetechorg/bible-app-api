# Production Dockerfile
FROM node:20-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable corepack
RUN corepack enable

# ===== DEPENDENCIES =====
FROM base AS deps

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install ALL dependencies
RUN pnpm install --frozen-lockfile

# ===== BUILDER =====
FROM base AS builder

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy package and source
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma and build
RUN pnpm prisma generate
RUN pnpm build

# ===== PRODUCTION =====
FROM base AS runner

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy prisma and generate
COPY prisma ./prisma
RUN pnpm prisma generate

# Copy built app
COPY --from=builder /app/dist ./dist

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start
CMD ["node", "dist/server.js"]
