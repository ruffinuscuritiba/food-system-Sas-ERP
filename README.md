# Food System SaaS ERP

Sistema ERP multi-tenant para restaurantes e food services. Gerencia pedidos, mesas, estoque, caixa, finanças e muito mais.

---

## Stack

| Camada    | Tecnologia                             |
|-----------|----------------------------------------|
| Backend   | NestJS 11 + Prisma 5 + PostgreSQL      |
| Frontend  | Next.js 16 + React 19 + Tailwind CSS 4 |
| Real-time | Socket.IO 4                            |
| Auth      | JWT + Passport                         |

---

## Pré-requisitos

- **Node.js** >= 20 (testado em v24.15.0)
- **npm** >= 10
- **PostgreSQL** >= 14 rodando localmente ou via Docker

### PostgreSQL via Docker (opção rápida)

```bash
docker run --name food-system-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=food_system \
  -p 5432:5432 \
  -d postgres:16
```

---

## Configuração do ambiente

### Backend — `backend/.env`

```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/food_system?schema=public"
JWT_SECRET="food-system-saas-erp-secret-super-seguro-2026"
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"
```

> Ajuste `DATABASE_URL` para as credenciais do seu PostgreSQL local.

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

---

## Instalação

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## Banco de dados

```bash
cd backend

# Rodar todas as migrations
npx prisma migrate deploy

# Gerar o Prisma Client
npx prisma generate

# Popular com dados de teste (empresa + usuários admin)
npm run seed
```

### Credenciais do seed

| Campo | Valor            |
|-------|------------------|
| Email | admin@teste.com  |
| Senha | 123456           |
| Role  | SUPER_ADMIN      |

Usuário alternativo: `admin@food.com` / `123456` (role: ADMIN)

---

## Rodando localmente

Abra dois terminais:

```bash
# Terminal 1 — Backend (porta 3001)
cd backend
npm run start:dev

# Terminal 2 — Frontend (porta 3000)
cd frontend
npm run dev
```

Acesse: **http://localhost:3000**

Swagger (documentação da API): **http://localhost:3001/api/docs**

---

## Módulos do sistema

### Backend (NestJS)

| Módulo        | Rota base             | Descrição                         |
|---------------|-----------------------|-----------------------------------|
| auth          | /api/auth             | Login e geração de JWT            |
| users         | /api/users            | Gestão de usuários por tenant     |
| company       | /api/company          | Dados e configurações da empresa  |
| products      | /api/products         | Cardápio e produtos                |
| categories    | /api/categories       | Categorias de produtos            |
| orders        | /api/orders           | Pedidos de delivery/balcão        |
| tables        | /api/tables           | Mesas do salão                    |
| table-orders  | /api/table-orders     | Pedidos por mesa                  |
| cash          | /api/cash             | Controle de caixa                 |
| financial     | /api/financial        | Lançamentos financeiros           |
| ingredients   | /api/ingredients      | Ingredientes/estoque              |
| recipes       | /api/recipes          | Fichas técnicas de produtos       |
| stock         | /api/stock            | Movimentações de estoque          |
| payments      | /api/payments         | Métodos de pagamento              |
| themes        | /api/themes           | Personalização visual por tenant  |
| audit         | /api/audit            | Logs de auditoria                 |
| notifications | /api/notifications    | Notificações                      |
| upload        | /api/upload           | Upload de imagens                 |
| admin         | /api/admin            | Painel super-admin                |

### Frontend (Next.js)

| Rota              | Descrição                         |
|-------------------|-----------------------------------|
| /                 | Landing page                      |
| /login            | Autenticação                      |
| /signup           | Cadastro de nova empresa          |
| /dashboard        | Painel principal com métricas     |
| /orders           | Gestão de pedidos                 |
| /tables           | Mapa de mesas                     |
| /kitchen          | Tela da cozinha (tempo real)      |
| /products         | Cardápio                          |
| /categories       | Categorias                        |
| /ingredients      | Ingredientes                      |
| /recipes          | Fichas técnicas                   |
| /stock            | Estoque                           |
| /pdv              | Ponto de venda                    |
| /pagamento        | Fechamento de conta               |
| /admin            | Gestão de usuários/empresa        |
| /super-admin      | Painel multi-tenant               |
| /planos           | Planos de assinatura              |
| /theme            | Personalização do tema            |
| /order-status     | Acompanhamento de pedido          |
| /menu             | Cardápio público                  |

---

## Arquitetura multi-tenant

Cada empresa (`Company`) é isolada por `companyId` em todos os modelos. O `TenantGuard` garante que toda requisição autenticada só acessa dados do tenant do usuário logado.

```
Company (tenant)
├── Users         (funcionários)
├── Products      (cardápio)
├── Orders        (pedidos)
├── Tables        (mesas)
├── Ingredients   (estoque)
├── Financial     (lançamentos)
└── AuditLogs     (rastreabilidade)
```

---

## Próximos passos para colocar online

### 1. Banco de dados — Supabase (recomendado, gratuito)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Vá em **Settings → Database → Connection string → URI**
3. Copie a URI e use como `DATABASE_URL` no backend

### 2. Backend — Render.com (gratuito)

1. Acesse [render.com](https://render.com) e crie um **Web Service**
2. Conecte ao repositório GitHub
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - **Start Command:** `npm run start:prod`
4. Em **Environment Variables**, adicione as variáveis do `backend/.env`
5. Após o deploy, copie a URL gerada (ex: `https://food-system-backend-xxxx.onrender.com`)

### 3. Frontend — Vercel (gratuito)

1. Acesse [vercel.com](https://vercel.com) e importe o repositório
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js
3. Em **Environment Variables**, adicione:
   ```
   NEXT_PUBLIC_API_URL=https://food-system-backend-xxxx.onrender.com/api
   NEXT_PUBLIC_SOCKET_URL=https://food-system-backend-xxxx.onrender.com
   NEXT_PUBLIC_FRONTEND_URL=https://seu-app.vercel.app
   ```
4. Deploy

### 4. Atualizar CORS no backend

No `backend/.env` de produção, atualize:
```env
FRONTEND_URL=https://seu-app.vercel.app
```

### 5. Rodar seed em produção (primeira vez)

```bash
# No Render, via Shell ou Build Command adicional
npm run seed
```

### 6. Domínio personalizado (opcional)

- Vercel: Settings → Domains → Add
- Render: Settings → Custom Domains

---

## Scripts úteis

```bash
# Backend
npm run start:dev       # Desenvolvimento com hot-reload
npm run build           # Build de produção
npm run start:prod      # Iniciar build de produção
npm run seed            # Popular banco com dados de teste
npx prisma studio       # Interface visual do banco

# Frontend
npm run dev             # Desenvolvimento
npm run build           # Build de produção
npm run start           # Iniciar build de produção
```

---

## Variáveis de ambiente — resumo

### Backend

| Variável       | Obrigatória | Descrição                              |
|----------------|-------------|----------------------------------------|
| PORT           | Não         | Porta do servidor (padrão: 3001)       |
| DATABASE_URL   | Sim         | String de conexão PostgreSQL           |
| JWT_SECRET     | Sim         | Chave secreta JWT (min. 32 chars)      |
| FRONTEND_URL   | Sim         | URL do frontend para CORS              |
| BACKEND_URL    | Não         | URL do próprio backend                 |

### Frontend

| Variável                   | Obrigatória | Descrição              |
|----------------------------|-------------|------------------------|
| NEXT_PUBLIC_API_URL        | Sim         | URL da API REST        |
| NEXT_PUBLIC_SOCKET_URL     | Sim         | URL do WebSocket       |
| NEXT_PUBLIC_FRONTEND_URL   | Não         | URL do próprio frontend|
