# ✅ Checklist de Deploy - Easypanel

## 📦 Preparação Local (5 min)

- [ ] **1. Testar build local**
  ```bash
  pnpm build
  # Deve compilar sem erros
  ```

- [ ] **2. Verificar arquivos criados**
  ```bash
  ls -la nixpacks.toml Dockerfile.easypanel start.sh
  # Todos devem existir
  ```

- [ ] **3. Commit e push**
  ```bash
  git add .
  git commit -m "Add: Easypanel deploy config"
  git push origin main
  ```

---

## 🗄️ Banco de Dados (3 min)

- [ ] **4. Criar PostgreSQL no Easypanel**
  - Services → Add Service → Database → PostgreSQL
  - Name: `bible-db`
  - User: `bibleuser`
  - Password: (gerar forte)
  - Database: `bibledb`

- [ ] **5. Copiar DATABASE_URL**
  ```
  Format: postgresql://bibleuser:password@bible-db:5432/bibledb
  ```

---

## 🚀 App no Easypanel (5 min)

### Build Settings

- [ ] **6. Criar novo App**
  - Services → Add Service → App

- [ ] **7. Source**
  - Repository: `seu-repo-git`
  - Branch: `main`

- [ ] **8. Build**
  - Build Method: **Nixpacks** ✅
  - Version: `1.41.0`
  - Install Command: **(vazio)** ⬜
  - Build Command: **(vazio)** ⬜
  - Start Command: **(vazio)** ⬜
  - Nix Packages: **(vazio)** ⬜
  - APT Packages: **(vazio)** ⬜

### Environment Variables

- [ ] **9. Adicionar variáveis OBRIGATÓRIAS**
  ```env
  NODE_ENV=production
  PORT=3001
  DATABASE_URL=postgresql://bibleuser:password@bible-db:5432/bibledb
  JWT_SECRET=           ← GERAR (min 32 chars)
  COOKIE_SECRET=        ← GERAR (min 32 chars)
  ```

- [ ] **10. Gerar chaves seguras**
  ```bash
  # No seu terminal local:
  openssl rand -base64 32
  # Cole no JWT_SECRET

  openssl rand -base64 32
  # Cole no COOKIE_SECRET
  ```

- [ ] **11. Adicionar variáveis OPCIONAIS**
  ```env
  CORS_ORIGIN=https://seu-frontend.com
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  STRIPE_SECRET_KEY=sk_...
  ```

### Networking

- [ ] **12. Configurar porta**
  - Internal Port: `3001`
  - Expose Publicly: **✅**
  - Domain: `bible-api.seu-dominio.com` (opcional)

### Health Check

- [ ] **13. Configurar health check**
  - Enabled: **✅**
  - Path: `/health`
  - Port: `3001`
  - Interval: `30s`
  - Timeout: `3s`
  - Retries: `3`

---

## 🎬 Deploy (2 min)

- [ ] **14. Iniciar deploy**
  - Click em **Deploy** ou **Save & Deploy**

- [ ] **15. Acompanhar logs**
  - Deployments → Ver último deploy → Logs
  - Aguardar: `Build completed successfully`

---

## 🔄 Migrations (2 min)

- [ ] **16. Rodar migrations**
  - Easypanel → App → Terminal
  ```bash
  pnpm prisma migrate deploy
  ```

- [ ] **17. (Opcional) Seed inicial**
  ```bash
  pnpm db:seed
  ```

---

## ✅ Validação (2 min)

- [ ] **18. Verificar status**
  - App deve estar: **Running** (verde)
  - Sem crashes

- [ ] **19. Testar health check**
  ```bash
  curl https://seu-app.com/health

  # Resposta esperada:
  # {
  #   "status": "healthy",
  #   "timestamp": "...",
  #   "version": "1.0.0",
  #   "services": {
  #     "database": "connected"
  #   }
  # }
  ```

- [ ] **20. Verificar logs**
  - Logs → Últimas linhas
  - Deve mostrar: `🚀 API running on http://0.0.0.0:3001`
  - Sem erros críticos

- [ ] **21. Testar endpoints**
  ```bash
  # Signup
  curl -X POST https://seu-app.com/api/v1/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"Test123!"}'

  # Login
  curl -X POST https://seu-app.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"Test123!"}'
  ```

---

## 🎉 Finalização

- [ ] **22. Configurar domínio customizado** (opcional)
- [ ] **23. Configurar SSL** (auto no Easypanel)
- [ ] **24. Configurar backups do DB**
- [ ] **25. Adicionar monitoring** (opcional)

---

## 🐛 Se Algo Falhar

### Build Failed

- [ ] Ver logs detalhados no Easypanel
- [ ] Verificar se `nixpacks.toml` está no repo
- [ ] Testar build local: `pnpm build`
- [ ] Adicionar Build Command se necessário:
  ```bash
  pnpm prisma generate && pnpm build
  ```

### App Crashed

- [ ] Verificar logs runtime
- [ ] Verificar DATABASE_URL está correta
- [ ] Verificar JWT_SECRET está definido
- [ ] Testar conexão com DB

### Cannot Connect to Database

- [ ] Verificar formato da DATABASE_URL
- [ ] Verificar se PostgreSQL está rodando
- [ ] Testar no terminal do app:
  ```bash
  echo $DATABASE_URL
  pnpm prisma db pull
  ```

### Module Not Found

- [ ] Verificar se build gerou dist/:
  ```bash
  ls -la dist/
  ```
- [ ] Rebuild se necessário:
  ```bash
  pnpm build
  ```

### Health Check Failing

- [ ] Verificar se app está rodando
- [ ] Verificar porta 3001
- [ ] Path correto: `/health`
- [ ] Testar manualmente:
  ```bash
  curl http://localhost:3001/health
  ```

---

## 📊 Progresso

```
┌────────────────────────────────────────┐
│ Preparação    [===     ] 3/25 (12%)   │
│ Database      [======  ] 5/25 (20%)   │
│ App Config    [=========] 13/25 (52%) │
│ Deploy        [===========] 15/25 (60%)│
│ Migrations    [=============] 17/25 (68%)│
│ Validação     [================] 21/25 (84%)│
│ Finalização   [====================] 25/25 (100%)│
└────────────────────────────────────────┘
```

---

## ⏱️ Tempo Estimado

| Fase | Tempo | Acumulado |
|------|-------|-----------|
| Preparação | 5 min | 5 min |
| Database | 3 min | 8 min |
| App Config | 5 min | 13 min |
| Deploy | 2 min | 15 min |
| Migrations | 2 min | 17 min |
| Validação | 2 min | 19 min |
| **TOTAL** | **~20 min** | - |

---

## 🎯 Próximo Deploy

Após o primeiro deploy bem-sucedido, os próximos são **muito mais rápidos**:

```bash
# 1. Fazer alterações no código
# 2. Commit e push
git add .
git commit -m "Update: sua mudança"
git push

# 3. Easypanel detecta e faz deploy automático
# ⏱️ Tempo: 2-3 minutos
```

---

## 📚 Documentação de Referência

- **EASYPANEL-CONFIG.md** → Detalhes de cada campo
- **QUICK-START.md** → Guia rápido completo
- **DEPLOY.md** → Troubleshooting avançado
- **COMPARACAO-DEPLOY.md** → Por que Nixpacks?

---

**Boa sorte! 🚀**
