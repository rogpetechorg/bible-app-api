# ⚡ Quick Start - Deploy Rápido no Easypanel

## 🎯 Método Mais Fácil: Nixpacks

### 1️⃣ Preparar o Projeto (5 min)

```bash
# Commit os arquivos novos
git add .
git commit -m "Add: Easypanel deploy config (Nixpacks)"
git push origin main
```

### 2️⃣ Configurar Easypanel (10 min)

#### Criar PostgreSQL:
1. Easypanel → **Add Service** → **Database** → **PostgreSQL**
2. Nome: `bible-db`
3. User: `bibleuser`
4. Password: (gerar seguro)
5. Database: `bibledb`
6. **Copiar a DATABASE_URL**

#### Criar App:
1. Easypanel → **Add Service** → **App**
2. Nome: `bible-api`
3. **Source:**
   - Repository: `seu-repo-git`
   - Branch: `main`

4. **Build:**
   - Build Method: **Nixpacks**
   - Build Command: (vazio)

5. **Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=postgresql://bibleuser:password@bible-db:5432/bibledb
   JWT_SECRET=GERE_UMA_CHAVE_SEGURA_AQUI
   COOKIE_SECRET=OUTRA_CHAVE_SEGURA_AQUI
   CORS_ORIGIN=https://seu-frontend.com
   ```

6. **Networking:**
   - Internal Port: `3001`
   - Public: ✅ Enable
   - Domain: `bible-api.seu-dominio.com`

7. **Deploy** 🚀

### 3️⃣ Rodar Migrations (2 min)

Após o primeiro deploy:

1. Easypanel → `bible-api` → **Terminal**
2. Executar:
   ```bash
   pnpm prisma migrate deploy
   ```

### 4️⃣ Verificar (1 min)

```bash
# Testar health check
curl https://bible-api.seu-dominio.com/health

# Deve retornar:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

---

## 🔥 Se Nixpacks FALHAR

### Use Dockerfile:

1. **Build Settings:**
   - Build Method: **Dockerfile**
   - Dockerfile Path: `Dockerfile.easypanel`

2. Resto igual ☝️

---

## 🐛 Problemas Comuns

### ❌ Build Failed

**Ver logs no Easypanel:**
```
Deployments → Ver último deploy → Logs
```

**Causas comuns:**
- ❌ Falta `pnpm-lock.yaml` → commit o arquivo
- ❌ Erro no TypeScript → `pnpm build` local
- ❌ Prisma não gerou → adicionar `pnpm prisma generate` no build

### ❌ App Crashed

**Ver logs runtime:**
```
Logs → Ver últimas linhas
```

**Causas comuns:**
- ❌ DATABASE_URL incorreta → verificar env vars
- ❌ JWT_SECRET faltando → adicionar env var
- ❌ Porta errada → usar `PORT=3001`

### ❌ Cannot Connect to Database

```bash
# No terminal do app:
echo $DATABASE_URL
# Verificar formato: postgresql://user:pass@host:5432/db

# Testar conexão:
pnpm prisma db pull
```

### ❌ Module Not Found

```bash
# Verificar build:
ls -la dist/
ls -la dist/modules/

# Se vazio:
pnpm build
```

---

## ✅ Checklist de Validação

Após deploy, verificar:

- [ ] App está **running** (não crashando)
- [ ] Health check responde: `/health`
- [ ] Logs sem erros críticos
- [ ] Database conectado
- [ ] Migrations rodaram
- [ ] Endpoints funcionando:
  - [ ] `POST /api/v1/auth/signup`
  - [ ] `POST /api/v1/auth/login`
  - [ ] `GET /api/v1/users/me` (com auth)

---

## 📊 Monitoramento

### Logs em tempo real:
```bash
# Easypanel → App → Logs
# Ou via CLI:
easypanel logs bible-api --follow
```

### Métricas:
- CPU: < 50%
- RAM: < 512MB
- Restarts: 0

---

## 🎉 Pronto!

Agora sua API está no ar. Próximos passos:

1. ✅ Configurar domínio customizado
2. ✅ Adicionar SSL (auto via Easypanel)
3. ✅ Configurar backups do DB
4. ✅ Adicionar monitoring (opcional)
5. ✅ Configurar CI/CD (opcional)

---

## 📚 Documentação

- [DEPLOY.md](./DEPLOY.md) - Guia completo
- [COMPARACAO-DEPLOY.md](./COMPARACAO-DEPLOY.md) - Comparação de métodos
- [README.md](./README.md) - Documentação da API

## 🆘 Suporte

Se tiver problemas:
1. Verificar logs do Easypanel
2. Testar build local: `pnpm build && pnpm start`
3. Ver issues no GitHub do projeto
