# 🧪 Testes

## Configuração

### 1. Banco de Dados de Teste

Os testes precisam de um banco PostgreSQL separado:

```bash
# Criar banco de teste
createdb bible_test

# Ou via Docker
docker run -d \
  --name bible-db-test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=bible_test \
  -p 5433:5432 \
  postgres:14-alpine
```

### 2. Variáveis de Ambiente

O arquivo `.env.test` já está configurado:

```env
DATABASE_URL=postgresql://test:test@localhost:5433/bible_test
```

**⚠️ Ajuste a porta se necessário!**

### 3. Rodar Migrations

```bash
# Aplicar migrations no banco de teste
DATABASE_URL="postgresql://test:test@localhost:5433/bible_test" pnpm prisma migrate deploy

# Ou usar o .env.test
dotenv -e .env.test -- pnpm prisma migrate deploy
```

## Rodando os Testes

```bash
# Todos os testes
pnpm test

# Com coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Apenas integration
pnpm test:integration

# Verbose
pnpm test:unit
```

## Estrutura

```
tests/
├── setup.ts              # Configuração global
├── integration/
│   └── flow.test.ts     # Teste de fluxo completo
└── README.md            # Este arquivo
```

## Cobertura

Os testes cobrem:

- ✅ Cadastro e Login
- ✅ Onboarding
- ✅ Planos e Assinatura
- ✅ Chat (limitações sem assinatura)
- ✅ LGPD - Exclusão de conta

## Notas

- Os testes usam `.env.test` automaticamente
- O banco de teste é limpo antes de cada execução
- API keys podem ser dummy values (não fazem chamadas reais para IA)
- Os testes de IA podem ser mockados se preferir

## Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Verificar se o banco está rodando
psql -U test -d bible_test -h localhost -p 5433

# Recriar banco
dropdb bible_test && createdb bible_test
DATABASE_URL="..." pnpm prisma migrate deploy
```

### Erro: "OPENAI_API_KEY missing"

Verifique se `.env.test` existe e tem as chaves (podem ser dummy).

### Erro: "Port already in use"

Mude a porta em `.env.test`:

```env
PORT=3002
```
