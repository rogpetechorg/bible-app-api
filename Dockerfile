# Production Dockerfile
FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable corepack
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma Client
RUN pnpm prisma generate

# Build TypeScript
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start
CMD ["node", "dist/server.js"]
