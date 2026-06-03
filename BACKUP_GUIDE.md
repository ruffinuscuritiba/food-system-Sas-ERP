# BACKUP_GUIDE — FoodSaaS ERP

> Gerado em 03/06/2026. Atualizar sempre que houver mudança de infraestrutura.

---

## 1. Visão geral do que precisa estar no backup

| Componente | Onde vive | Crítico? |
|------------|-----------|----------|
| Código-fonte | GitHub `ruffinuscuritiba/food-system-Sas-ERP` | ✅ |
| Schema Prisma | `backend/prisma/schema.prisma` | ✅ |
| Migrations (42) | `backend/prisma/migrations/` | ✅ |
| Seed scripts | `backend/prisma/seed.ts` | ✅ |
| Variáveis de ambiente backend | Render dashboard (não estão no git) | ✅ |
| Variáveis de ambiente frontend | Vercel dashboard (não estão no git) | ✅ |
| Banco PostgreSQL | Supabase | ✅ |
| Imagens demo | `frontend/public/demo-assets/` | ✅ (no git) |
| node_modules | Regenerado via `npm install` | ❌ não faz parte do backup |

---

## 2. Diretórios críticos do projeto

```
food-system-Sas-ERP/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          ← modelo de dados completo (1151+ linhas)
│   │   ├── seed.ts                ← seed de empresas demo e catálogo de módulos
│   │   └── migrations/            ← 42 migrations sequenciais
│   ├── src/                       ← código-fonte NestJS
│   ├── .env                       ← NÃO está no git — backup manual obrigatório
│   ├── .env.example               ← template de variáveis (está no git)
│   ├── package.json               ← dependências backend
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── render.yaml                ← config de deploy Render
├── frontend/
│   ├── app/                       ← páginas Next.js (App Router)
│   ├── components/                ← componentes React
│   ├── public/demo-assets/        ← imagens das demos (20 JPEGs, no git)
│   ├── .env.local                 ← NÃO está no git — backup manual obrigatório
│   ├── .env.example               ← template (está no git)
│   ├── package.json               ← dependências frontend
│   └── vercel.json
├── CLAUDE.md                      ← memória técnica do projeto
├── BACKUP_GUIDE.md                ← este arquivo
└── RECOVERY_GUIDE.md
```

---

## 3. Variáveis de ambiente — Backend (Render)

Localização: **Render dashboard → food-system-backend → Environment**

> Estas variáveis NÃO estão no git. Exportar/salvar manualmente em local seguro.

```env
# Banco de dados (Supabase)
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require

# Autenticação
JWT_SECRET=<gerado pelo Render>

# URLs
FRONTEND_URL=https://food-system-sas-erp-frontend.vercel.app
BACKEND_URL=https://food-system-backend-no7d.onrender.com

# IA — Cadastro Inteligente (ordem de fallback: Gemini → OpenRouter → Anthropic)
GEMINI_API_KEY=<sua chave AIStudio>
GEMINI_MODEL=gemini-1.5-flash
OPENROUTER_API_KEY=<sua chave OpenRouter>
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
ANTHROPIC_API_KEY=<sua chave Anthropic>

# Pagamentos
MERCADOPAGO_ACCESS_TOKEN=<token MercadoPago>

# Cloudinary (upload de imagens)
CLOUDINARY_CLOUD_NAME=<cloud name>
CLOUDINARY_API_KEY=<api key>
CLOUDINARY_API_SECRET=<api secret>

# Node
NODE_VERSION=22.13.0
```

---

## 4. Variáveis de ambiente — Frontend (Vercel)

Localização: **Vercel dashboard → food-system-sas-erp-frontend → Settings → Environment Variables**

```env
NEXT_PUBLIC_API_URL=https://food-system-backend-no7d.onrender.com/api
NEXT_PUBLIC_SOCKET_URL=https://food-system-backend-no7d.onrender.com
NEXT_PUBLIC_FRONTEND_URL=https://food-system-sas-erp-frontend.vercel.app
```

---

## 5. Migrations Prisma (42 total)

Todas as migrations estão no git em `backend/prisma/migrations/`. Sequência completa:

```
20260509222747_init
20260509225603_ingredient_minimum_stock
20260509231705_add_order_cmv_profit
20260510004445_order_product_metrics
20260510011223_kitchen_status
20260510025736_add_companyid_product
20260511003053_company_theme
20260511215649_update_user_model
20260512175327_create_cash
20260513033725_fix_schema
20260513230011_restructuring_erp_core
20260514222524_create_audit_logs
20260515161854_create_stock_item_structure
20260515173837_order_enterprise_upgrade
20260523000000_add_company_id_recipe_item
20260524000000_add_payment_model
20260524000001_add_loyalty_system
20260524000002_add_tracking_to_theme
20260524000003_add_chat_coupon
20260525000000_add_module_catalog
20260525000000_add_online_orders
20260525000001_add_smart_import
20260526000000_add_pizza_sizes_borders
20260526010000_pizza_size_to_text
20260526020000_delivery_module
20260526040000_bi_ai_module
20260527000000_add_tracking_to_company
20260527100000_add_pizza_borders
20260527200000_add_pizza_pricing_mode
20260527300000_add_complements_beverages_size_config
20260528000000_add_product_video
20260528200000_add_whatsapp_ai
20260529000000_fix_db_sync
20260529100000_add_order_type_fields
20260530000000_add_sort_order
20260530120000_add_white_label_theme
20260530170000_pizza_size_config_to_text
20260601000000_fix_company_plan_default
20260601100000_add_demo_role
20260601200000_add_company_archived
20260601300000_add_plan_config
(+ eventuais novas migrations após esta data)
```

---

## 6. Dependências — Backend (31 packages)

Stack: **NestJS 11 + TypeScript + Prisma 5**

```json
{
  "@anthropic-ai/sdk": "^0.39.0",
  "@google/generative-ai": "^0.21.0",
  "@nestjs/common": "^11.0.1",
  "@nestjs/config": "^3.3.0",
  "@nestjs/core": "^11.0.1",
  "@nestjs/jwt": "^11.0.0",
  "@nestjs/passport": "^11.0.5",
  "@nestjs/platform-express": "^11.0.1",
  "@nestjs/platform-socket.io": "^11.0.1",
  "@nestjs/swagger": "^8.1.1",
  "@nestjs/websockets": "^11.0.1",
  "bcrypt": "^5.1.1",
  "class-transformer": "^0.5.1",
  "class-validator": "^0.14.1",
  "cloudinary": "^2.5.1",
  "fast-xml-parser": "^4.5.0",
  "multer": "^1.4.5-lts.1",
  "nodemailer": "^6.10.0",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.1",
  "pdf-parse": "^1.1.1",
  "prisma": "^5.22.0",
  "@prisma/client": "^5.22.0",
  "rxjs": "^7.8.1",
  "socket.io": "^4.8.1",
  "xlsx": "^0.18.5"
}
```

---

## 7. Dependências — Frontend (20 packages)

Stack: **Next.js 16 + React 19 + Tailwind CSS 4**

```json
{
  "@hello-pangea/dnd": "^17.0.0",
  "@tanstack/react-query": "^5.62.16",
  "axios": "^1.7.9",
  "framer-motion": "^11.16.0",
  "js-cookie": "^3.0.5",
  "lucide-react": "^0.469.0",
  "next": "16.2.0",
  "qrcode.react": "^4.2.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-hot-toast": "^2.4.1",
  "recharts": "^2.15.0",
  "socket.io-client": "^4.8.1",
  "tailwind-merge": "^2.5.5",
  "tailwindcss": "^4.0.0",
  "zustand": "^5.0.3"
}
```

---

## 8. Backup do banco PostgreSQL (Supabase)

### 8.1 Via Supabase Dashboard (mais fácil)

1. Acesse: **Supabase → Project → Database → Backups**
2. Clique em **Download backup** para baixar o dump mais recente
3. Supabase gera backups automáticos diários (plano Free: 7 dias de retenção)

### 8.2 Via `pg_dump` (backup manual completo)

```bash
# Obtém a connection string no Supabase: Settings → Database → Connection string (URI)
export DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require"

# Dump completo (schema + dados)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=foodsaas_backup_$(date +%Y%m%d_%H%M).dump

# Dump só do schema (sem dados)
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --file=foodsaas_schema_$(date +%Y%m%d).sql
```

### 8.3 Tabelas críticas (não podem faltar no backup)

```
Company, User, CompanyModule, Module
Category, Product, ProductSize
Order, OrderItem, OnlineOrder
Customer, LoyaltyAccount
Ingredient, Recipe, RecipeItem, StockMovement
Financial, Cash
WhatsappConnection, WhatsappAiSettings, WhatsappConversation
CompanyTheme, PizzaBorder, PizzaSizeConfig, Complement
AuditLog, KpiSnapshot
```

### 8.4 Frequência recomendada

| Evento | Ação |
|--------|------|
| Antes de qualquer migration | `pg_dump` manual |
| Antes de deletar empresas | `pg_dump` manual |
| Diariamente (automático) | Supabase Daily Backup |
| Antes de alterações estruturais | `pg_dump` + commit de schema |

---

## 9. Checklist de backup completo

```
[ ] git push origin main (código e migrations no GitHub)
[ ] Exportar DATABASE_URL do Render (salvar em local seguro)
[ ] Exportar todas as env vars do Render
[ ] Exportar env vars do Vercel
[ ] Executar pg_dump do banco Supabase
[ ] Verificar que todas as 42+ migrations estão no git
[ ] Verificar que backend/prisma/seed.ts está no git
[ ] Verificar que frontend/public/demo-assets/ está no git
```
