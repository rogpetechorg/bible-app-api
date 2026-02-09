#!/bin/sh
# Install dependencies if needed
if [ ! -d "/app/node_modules/.pnpm" ]; then
  echo "Installing dependencies..."
  cd /app && pnpm install --frozen-lockfile
fi

# Rebuild native modules to ensure they're compiled for the container's architecture
echo "Rebuilding native modules..."
cd /app && pnpm rebuild bcrypt

# Generate Prisma client
echo "Generating Prisma client..."
cd /app && pnpm prisma generate

# Run the dev server
echo "Starting dev server..."
cd /app && pnpm dev
