# 🎛️ Configuração Easypanel - Campo por Campo

## 📋 Build Settings (Nixpacks)

### Version
```
1.41.0
```
✅ **Deixar como está** (versão padrão é OK)

---

### Install Command
```
(deixar vazio)
```
❌ **DEIXAR VAZIO**

**Por quê?**
- O Nixpacks já detecta automaticamente `pnpm install` pelo `package.json`
- O arquivo `nixpacks.toml` já configura isso

---

### Build Command
```
(deixar vazio)
```
❌ **DEIXAR VAZIO**

**Por quê?**
- O `nixpacks.toml` já define:
  - `pnpm prisma generate`
  - `pnpm build`
- Deixar vazio usa a configuração automática

**⚠️ SE TIVER PROBLEMAS**, tente:
```bash
pnpm prisma generate && pnpm build
```

---

### Start Command
```
(deixar vazio)
```
❌ **DEIXAR VAZIO**

**Por quê?**
- O `nixpacks.toml` já define: `node dist/server.js`
- O `package.json` tem script: `"start": "node dist/server.js"`

**⚠️ SE TIVER PROBLEMAS**, tente:
```bash
node dist/server.js
```

---

### Nix Packages
```
(deixar vazio)
```
❌ **DEIXAR VAZIO**

**Por quê?**
- O `nixpacks.toml` já define:
  ```toml
  nixPkgs = ["nodejs_20", "openssl"]
  ```
- Node.js 20 e OpenSSL já estão configurados

**⚠️ SE PRECISAR adicionar algo:**
```
python3 git
```
(separado por espaço, mas NÃO é necessário para este projeto)

---

### APT Packages
```
(deixar vazio)
```
❌ **DEIXAR VAZIO**

**Por quê?**
- Nixpacks usa Nix, não APT
- Todas dependências já estão no `nixpacks.toml`

**⚠️ Só use se Nixpacks não tiver o pacote:**
```
libssl-dev
```
(mas não é necessário)

---

## ✅ Resumo - O QUE PREENCHER

| Campo | Valor | Observação |
|-------|-------|------------|
| Version | `1.41.0` | Padrão OK |
| Install Command | **(vazio)** | Auto-detectado |
| Build Command | **(vazio)** | Definido em nixpacks.toml |
| Start Command | **(vazio)** | Definido em nixpacks.toml |
| Nix Packages | **(vazio)** | Definido em nixpacks.toml |
| APT Packages | **(vazio)** | Não necessário |

**TL;DR: DEIXE TUDO VAZIO! 🎉**

---

## 🎯 Configuração Completa do Easypanel

### 1️⃣ General

```
Name: bible-api
```

### 2️⃣ Source

```
Repository: https://github.com/seu-usuario/seu-repo
Branch: main
Auto Deploy: ✅ (opcional)
```

### 3️⃣ Build

```
Build Method: Nixpacks
Nixpacks Version: 1.41.0
Install Command: (vazio)
Build Command: (vazio)
Start Command: (vazio)
Nix Packages: (vazio)
APT Packages: (vazio)
```

### 4️⃣ Environment Variables

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@bible-db:5432/bibledb
JWT_SECRET=gere-uma-chave-segura-aqui-min-32-chars
COOKIE_SECRET=outra-chave-segura-diferente
CORS_ORIGIN=https://seu-frontend.com
```

**Gerar chaves seguras:**
```bash
# No seu terminal local:
openssl rand -base64 32
# Copie o output para JWT_SECRET e COOKIE_SECRET
```

### 5️⃣ Networking

```
Internal Port: 3001
Expose Publicly: ✅
Domain: bible-api.seu-dominio.com (opcional)
```

### 6️⃣ Health Check

```
Enabled: ✅
Path: /health
Port: 3001
Interval: 30s
Timeout: 3s
Retries: 3
```

### 7️⃣ Resources (Opcional)

```
CPU: 0.5 (500m)
Memory: 512 MB
```

---

## 🔍 Por Que Deixar Tudo Vazio?

O `nixpacks.toml` já configura tudo:

```toml
[phases.install]
cmds = ["pnpm install --frozen-lockfile"]  # ← Install Command

[phases.build]
cmds = [
  "pnpm prisma generate",                   # ← Build Command
  "pnpm build"
]

[start]
cmd = "node dist/server.js"                 # ← Start Command

[phases.setup]
nixPkgs = ["nodejs_20", "openssl"]          # ← Nix Packages
```

**Vantagem:** Centraliza a config no código, não na UI!

---

## ⚠️ Troubleshooting

### Se o Build Falhar

**1. Adicione Build Command:**
```bash
pnpm prisma generate && pnpm build
```

**2. Verifique os logs:**
```
Easypanel → Deployments → Ver último build → Logs
```

**3. Erros comuns:**

#### "pnpm: command not found"
- Adicione Install Command:
  ```bash
  corepack enable && corepack prepare pnpm@latest --activate
  ```

#### "Prisma Client not generated"
- O Build Command já tem `pnpm prisma generate`
- Se ainda falhar, adicione Nix Package:
  ```
  openssl
  ```

#### "TypeScript error"
- Teste local: `pnpm build`
- Verifique `tsconfig.json`

---

## 🎬 Passo a Passo Visual

### Tela 1: Build Settings
```
┌─────────────────────────────────────┐
│ Build Method: [Nixpacks        ▼]  │
│                                     │
│ Version: 1.41.0                     │
│                                     │
│ Install Command:                    │
│ ┌─────────────────────────────────┐ │
│ │ (deixar vazio)                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Build Command:                      │
│ ┌─────────────────────────────────┐ │
│ │ (deixar vazio)                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Start Command:                      │
│ ┌─────────────────────────────────┐ │
│ │ (deixar vazio)                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Tela 2: Environment
```
┌─────────────────────────────────────┐
│ Environment Variables:              │
│                                     │
│ NODE_ENV        = production        │
│ PORT            = 3001              │
│ DATABASE_URL    = postgresql://...  │
│ JWT_SECRET      = sua-chave-aqui    │
│ COOKIE_SECRET   = outra-chave       │
│ CORS_ORIGIN     = https://...       │
│                                     │
│ [+ Add Variable]                    │
└─────────────────────────────────────┘
```

### Tela 3: Networking
```
┌─────────────────────────────────────┐
│ Internal Port: [3001]               │
│                                     │
│ ☑ Expose Publicly                   │
│                                     │
│ Domain (optional):                  │
│ ┌─────────────────────────────────┐ │
│ │ bible-api.seu-dominio.com       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## ✅ Checklist de Configuração

Antes de fazer o primeiro deploy:

- [ ] Build Method = **Nixpacks**
- [ ] Todos os campos de command = **(vazios)**
- [ ] Environment Variables = **configuradas**
  - [ ] NODE_ENV
  - [ ] PORT
  - [ ] DATABASE_URL
  - [ ] JWT_SECRET
  - [ ] COOKIE_SECRET
- [ ] Internal Port = **3001**
- [ ] Expose Publicly = **✅**
- [ ] Health Check Path = **/health**

---

## 🚀 Deploy!

Após configurar tudo:

1. Click em **Deploy**
2. Aguarde o build (~2-3 min)
3. Verifique os logs
4. Acesse o terminal e rode:
   ```bash
   pnpm prisma migrate deploy
   ```
5. Teste: `curl https://seu-app.com/health`

---

## 💡 Dicas Finais

### ✅ Deixe vazio = Mais fácil
- Nixpacks detecta tudo automaticamente
- Menos chances de erro
- Config no código (nixpacks.toml)

### ⚠️ Só preencha se necessário
- Se tiver erro específico
- Se precisar customizar algo
- Para debugging

### 🎯 Mantenha simples
- Menos configuração = Menos problemas
- Use o padrão sempre que possível
- Só customize quando realmente precisar

**Boa sorte! 🍀**
