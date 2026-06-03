# RECOVERY_GUIDE — FoodSaaS ERP

> Procedimento para recriar o ambiente do zero a partir do backup.
> Tempo estimado: 30–60 minutos para ambiente completo.

---

## Pré-requisitos

```bash
node --version   # v24.x (recomendado) ou v22.x
npm --version    # 11.x
git --version    # qualquer versão recente
```

Ferramentas opcionais:
- `pg_dump` / `pg_restore` (para restore do banco)
- `psql` (para verificar banco)

---

## Cenário 1 — Ambiente de desenvolvimento local

### 1. Clonar o repositório

```bash
git clone https://github.com/ruffinuscuritiba/food-system-Sas-ERP.git
cd food-system-Sas-ERP
```

### 2. Configurar variáveis de ambiente — Backend

```bash
cd backend
cp .env.example .env
```

Editar `backend/.env` com os valores reais:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require
JWT_SECRET=qualquer-string-segura-local
PORT=3001
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
GEMINI_API_KEY=<sua chave>
ANTHROPIC_API_KEY=<sua chave opcional>
```

### 3. Instalar dependências — Backend

```bash
cd backend
npm install
```

### 4. Gerar Prisma Client

```bash
npx prisma generate
```

### 5. Executar migrations

```bash
npx prisma migrate deploy
```

> Se houver erros de migration duplicada, use:
> ```bash
> npx prisma migrate resolve --rolled-back <nome_da_migration>
> ```

### 6. (Opcional) Popular banco com dados de seed

```bash
npx ts-node prisma/seed.ts
```

Isso cria:
- `company-seed-001` — Restaurante Demo (origem do cloneMenu)
- `company-seed-002` — Pizzaria Bella Napoli (exemplo)
- `company-seed-003` — Burger Fusion (exemplo)
- Usuário: `admin@teste.com / 123456` (SUPER_ADMIN)

### 7. Iniciar backend em desenvolvimento

```bash
npm run start:dev
```

Backend disponível em: `http://localhost:3001`

---

### 8. Configurar variáveis de ambiente — Frontend

```bash
cd ../frontend
cp .env.example .env.local
```

Editar `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### 9. Instalar dependências — Frontend

```bash
cd frontend
npm install
```

### 10. Iniciar frontend em desenvolvimento

```bash
npm run dev
```

Frontend disponível em: `http://localhost:3000`

---

## Cenário 2 — Restore completo de produção (Render + Vercel)

### 2.1 Restore do banco PostgreSQL

#### Via pg_restore (backup gerado com `pg_dump --format=custom`)

```bash
export DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require"

# Drop e recria o schema (ATENÇÃO: apaga todos os dados)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
pg_restore \
  --no-owner \
  --no-acl \
  --dbname="$DATABASE_URL" \
  foodsaas_backup_YYYYMMDD_HHMM.dump
```

#### Via arquivo SQL

```bash
psql "$DATABASE_URL" < foodsaas_backup_YYYYMMDD.sql
```

#### Via Supabase Dashboard

1. Supabase → Project → Database → Backups
2. Selecione o ponto de restore desejado
3. Clique **Restore**

### 2.2 Re-deploy Backend (Render)

1. Acesse: [render.com](https://render.com) → `food-system-backend`
2. Verifique que todas as env vars estão configuradas (ver `BACKUP_GUIDE.md` seção 3)
3. Clique **Manual Deploy → Deploy latest commit**
4. O `buildCommand` em `render.yaml` executa automaticamente:
   - `npm install`
   - `npx prisma generate`
   - `npx prisma migrate resolve --rolled-back <migrations>` (idempotente)
   - `npx prisma migrate deploy`
   - `npm run build`

### 2.3 Re-deploy Frontend (Vercel)

1. Acesse: [vercel.com](https://vercel.com) → `food-system-sas-erp-frontend`
2. Verifique env vars (ver `BACKUP_GUIDE.md` seção 4)
3. Clique **Redeploy**
4. Ou force via push no GitHub (Vercel auto-deploya a cada push)

---

## Cenário 3 — Banco corrompido, código íntegro

Se o banco perdeu dados mas o código está ok:

```bash
# 1. Restore do último pg_dump
pg_restore --dbname="$DATABASE_URL" backup.dump

# 2. Re-executar migrations faltantes (se houver)
cd backend
npx prisma migrate deploy

# 3. Re-popular demos (não afeta dados reais)
curl -X POST https://food-system-backend-no7d.onrender.com/api/super-admin/demo/vitrine \
  -H "Authorization: Bearer <token_superadmin>"
```

---

## Cenário 4 — Código corrompido, banco íntegro

```bash
# 1. Clonar repositório limpo
git clone https://github.com/ruffinuscuritiba/food-system-Sas-ERP.git foodsaas-clean
cd foodsaas-clean

# 2. Checkout do último commit estável
git log --oneline -10        # identificar commit estável
git checkout <commit-hash>   # ou manter HEAD

# 3. Configurar .env (usar backup das variáveis)
# (ver BACKUP_GUIDE.md seções 3 e 4)

# 4. Instalar dependências
cd backend && npm install
cd ../frontend && npm install

# 5. Não executar migrations (banco já está atualizado)
cd backend && npx prisma generate

# 6. Deploy
# Render: push para main → auto-deploy
# Vercel: push para main → auto-deploy
```

---

## Senhas e credenciais padrão (pós-seed)

| Conta | Email | Senha | Role |
|-------|-------|-------|------|
| Super Admin sistema | `superadmin@system.com` | `SuperAdmin@123` | SYSTEM_SUPER_ADMIN |
| Admin principal | `admin@teste.com` | `123456` | SUPER_ADMIN |
| Demo BASIC | `demo-basic@foodsaas.demo` | `DemoBasic@123` | DEMO |
| Demo PRO | `demo-pro@foodsaas.demo` | `DemoPro@123` | DEMO |
| Demo ENTERPRISE | `demo-enterprise@foodsaas.demo` | `DemoEnterprise@123` | DEMO |

> ⚠️ Trocar todas as senhas padrão em produção imediatamente após restore.

---

## Verificações pós-restore

```bash
# 1. Backend respondendo
curl https://food-system-backend-no7d.onrender.com/api/health
# Esperado: {"status":"ok","service":"food-system-backend",...}

# 2. Login funcionando
curl -X POST https://food-system-backend-no7d.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","password":"123456"}'
# Esperado: {"accessToken":"...","user":{...}}

# 3. Banco com dados
curl -X POST https://food-system-backend-no7d.onrender.com/api/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@system.com","password":"SuperAdmin@123"}' | python -c "
import sys,json; d=json.load(sys.stdin)
token=d.get('accessToken','')
print('Token OK:', bool(token))
"

# 4. Frontend acessível
curl -I https://food-system-sas-erp-frontend.vercel.app
# Esperado: HTTP/2 200
```

---

## Referências

| Recurso | URL |
|---------|-----|
| Repositório | https://github.com/ruffinuscuritiba/food-system-Sas-ERP |
| Backend (Render) | https://food-system-backend-no7d.onrender.com |
| Frontend (Vercel) | https://food-system-sas-erp-frontend.vercel.app |
| Banco (Supabase) | Dashboard Supabase → projeto ativo |
| Documentação técnica | `CLAUDE.md` na raiz do projeto |
