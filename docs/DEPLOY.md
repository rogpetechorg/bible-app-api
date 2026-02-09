# 🚀 Deploy no Easypanel

## Opção 1: Nixpacks (Recomendado)

### Configuração no Easypanel:

1. **Criar novo serviço**
2. **Build Settings:**
   - Build Method: `Nixpacks`
   - Build Command: (deixar vazio, usar nixpacks.toml)

3. **Variáveis de Ambiente:**
   ```env
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=postgresql://user:pass@host:5432/db
   JWT_SECRET=your-secret-key
   CORS_ORIGIN=https://your-frontend.com
   ```

4. **Port Mapping:**
   - Container Port: `3001`
   - Public Port: `80` ou `443`

5. **Health Check:**
   - Path: `/health`
   - Port: `3001`

### Deploy:
```bash
git push origin main
```

---

## Opção 2: Dockerfile

Se Nixpacks não funcionar, use:

1. **Build Settings:**
   - Build Method: `Dockerfile`
   - Dockerfile: `Dockerfile.easypanel`

2. Resto da configuração igual à Opção 1

---

## Banco de Dados

### Criar PostgreSQL no Easypanel:

1. Adicionar serviço PostgreSQL
2. Copiar a `DATABASE_URL`
3. Adicionar nas variáveis de ambiente do app

### Rodar migrations:

**Opção A - Localmente:**
```bash
DATABASE_URL="postgresql://..." pnpm prisma migrate deploy
```

**Opção B - No container (via Easypanel Terminal):**
```bash
cd /app
pnpm prisma migrate deploy
```

---

## Troubleshooting

### Erro: "Cannot find module"
- Verificar se o build completou: `ls -la /app/dist`
- Verificar extensões .js nos imports

### Erro: "Prisma Client not found"
- Rodar: `pnpm prisma generate`
- Verificar se OpenSSL está instalado

### Erro: "Port already in use"
- Verificar PORT nas env vars
- Usar `0.0.0.0` no host (já configurado)

### Erro de conexão com banco
- Verificar DATABASE_URL
- Testar conexão: `pnpm prisma db pull`

### Build muito lento
- Usar build cache do Easypanel
- Considerar reduzir dependências

---

## Comandos Úteis

### Local Development:
```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

### Production Build Test:
```bash
pnpm build
NODE_ENV=production pnpm start
```

### Database:
```bash
# Migrations
pnpm prisma migrate deploy

# Seed
pnpm db:seed

# Studio
pnpm db:studio
```

### Docker Test:
```bash
docker build -f Dockerfile.easypanel -t bible-api .
docker run -p 3001:3001 --env-file .env bible-api
```

---

## Checklist de Deploy

- [ ] Criar PostgreSQL no Easypanel
- [ ] Copiar DATABASE_URL
- [ ] Configurar todas env vars
- [ ] Fazer push do código
- [ ] Aguardar build
- [ ] Rodar migrations
- [ ] Testar `/health` endpoint
- [ ] Testar login/signup
- [ ] Verificar logs
