#!/bin/sh
set -e

echo "🚀 Starting Bible App API..."

# Verificar variáveis de ambiente essenciais
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL não definida"
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "⚠️  WARNING: JWT_SECRET não definida, usando valor padrão (INSEGURO!)"
fi

# Verificar se o Prisma Client foi gerado
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "📦 Gerando Prisma Client..."
  pnpm prisma generate
fi

# Opcional: Rodar migrations automaticamente (comentado por segurança)
# echo "🔄 Rodando migrations..."
# pnpm prisma migrate deploy

echo "✅ Iniciando servidor..."
exec node dist/server.js
