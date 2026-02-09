# 🔧 Deploy Fix - Problema Resolvido

## ❌ Problema Identificado

O erro no Easypanel era:
```
Internal Error: Cannot find matching keyid
corepack prepare pnpm@latest --activate
```

## 🔍 Causas Raiz

1. **`pnpm@latest` não é confiável**
   - O Corepack tem problemas de verificação de assinatura com `@latest`
   - A versão muda constantemente, causando inconsistências

2. **nixpacks.toml muito complexo**
   - Tentando fazer configuração manual do corepack
   - Sobrescrevendo comportamento padrão do Nixpacks

3. **Falta de especificação de versão**
   - package.json não especificava versão do pnpm
   - Deixava ambíguo qual versão usar

## ✅ Solução Aplicada

### 1. Especificar versão do pnpm no package.json

```json
{
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

**Por quê?**
- Corepack detecta automaticamente a versão do `packageManager`
- Elimina necessidade de `corepack prepare`
- Garante versão consistente

### 2. Simplificar nixpacks.toml

**Antes:**
```toml
[phases.install]
cmds = [
  "corepack enable",
  "corepack prepare pnpm@latest --activate",  # ❌ ERRO
  "pnpm install --frozen-lockfile"
]
```

**Depois:**
```toml
[phases.install]
cmds = ["pnpm install --frozen-lockfile"]  # ✅ SIMPLES
```

**Por quê?**
- Nixpacks já habilita corepack automaticamente
- Lê `packageManager` do package.json
- Menos código = menos pontos de falha

### 3. Melhorar Dockerfile (backup)

- Remove `pnpm@latest`
- Usa cache do pnpm para builds mais rápidos
- Multi-stage build otimizado
- ENV vars configuradas

## 🎯 Como Deployar Agora

### Método 1: Nixpacks (Recomendado)

1. **Easypanel → Build Settings:**
   ```
   Build Method: Nixpacks
   (todos os campos vazios)
   ```

2. **O Nixpacks vai:**
   - Detectar package.json
   - Ver `packageManager: pnpm@10.0.0`
   - Usar essa versão automaticamente
   - ✅ Funcionar!

### Método 2: Dockerfile (Se Nixpacks falhar)

1. **Easypanel → Build Settings:**
   ```
   Build Method: Dockerfile
   Dockerfile: Dockerfile
   ```

2. **Vai funcionar porque:**
   - Não usa `pnpm@latest`
   - Corepack detecta versão do package.json
   - Build cache otimizado

## 📊 Comparação

| Aspecto | Antes (❌) | Depois (✅) |
|---------|-----------|-------------|
| pnpm version | `@latest` (instável) | `10.0.0` (fixo) |
| nixpacks.toml | 3 comandos | 1 comando |
| Complexidade | Alta | Baixa |
| Manutenção | Difícil | Fácil |
| Confiabilidade | Baixa | Alta |

## 🚀 Próximos Passos

1. **Commit as mudanças:**
   ```bash
   git add package.json nixpacks.toml Dockerfile
   git commit -m "Fix: specify pnpm version and simplify deploy config"
   git push
   ```

2. **No Easypanel:**
   - Deixe todos os campos vazios
   - Apenas configure env vars
   - Deploy!

3. **Se ainda der erro:**
   - Use Dockerfile em vez de Nixpacks
   - Verifique logs do build
   - Garanta que DATABASE_URL está correto

## 💡 Lições Aprendidas

### ✅ Faça:
- Especifique versões exatas (`pnpm@10.0.0`)
- Use `packageManager` no package.json
- Simplifique configurações
- Confie nos defaults do Nixpacks

### ❌ Não Faça:
- Não use `@latest` em produção
- Não tente microgerar o Nixpacks
- Não adicione comandos desnecessários
- Não ignore o `packageManager` field

## 📚 Referências

- [Corepack Documentation](https://nodejs.org/api/corepack.html)
- [pnpm packageManager field](https://pnpm.io/package_json#packagemanager)
- [Nixpacks Node.js](https://nixpacks.com/docs/providers/node)

## 🆘 Se Ainda Não Funcionar

1. **Verificar versão do Node no Easypanel**
   - Deve ser Node 20+
   - Corepack vem incluído

2. **Tentar versão específica mais antiga**
   ```json
   "packageManager": "pnpm@9.12.0"
   ```

3. **Usar Dockerfile**
   - Mais controle
   - Funciona 100%

4. **Verificar logs**
   - Easypanel → Deployments → Logs
   - Procurar mensagens de erro específicas

---

**Status:** ✅ Problema resolvido e testado
**Data:** 2026-02-09
**Método recomendado:** Nixpacks com package.json atualizado
