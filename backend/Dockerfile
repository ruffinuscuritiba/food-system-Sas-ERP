# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copia manifests primeiro (aproveita cache de camadas)
COPY package*.json ./
COPY prisma ./prisma/

# Instala todas as dependências (incluindo devDeps para compilar)
RUN npm install

# Gera o Prisma Client
RUN npx prisma generate

# Copia o código-fonte e compila
COPY . .
RUN npm run build

# Remove devDependencies do node_modules
RUN npm prune --omit=dev

# ── Stage 2: Produção ───────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

# Apenas o necessário para rodar
COPY --from=builder /app/dist           ./dist
COPY --from=builder /app/node_modules   ./node_modules
COPY --from=builder /app/prisma         ./prisma
COPY package*.json ./

# Diretório de uploads locais (fallback quando não há Cloudinary)
RUN mkdir -p /app/uploads

EXPOSE 3001

# Resolve migrações com falha (idempotente) e inicia o servidor
CMD ["sh", "-c", "set -a; [ -f /etc/secrets/.env ] && . /etc/secrets/.env; set +a; npx prisma migrate resolve --rolled-back 20260524000000_add_payment_model 2>/dev/null; npx prisma migrate resolve --rolled-back 20260524000001_add_loyalty_system 2>/dev/null; npx prisma migrate resolve --rolled-back 20260524000002_add_tracking_to_theme 2>/dev/null; npx prisma migrate resolve --rolled-back 20260524000003_add_chat_coupon 2>/dev/null; npx prisma migrate resolve --rolled-back 20260526000000_add_pizza_sizes_borders 2>/dev/null; npx prisma migrate resolve --rolled-back 20260526040000_bi_ai_module 2>/dev/null; npx prisma migrate resolve --rolled-back 20260527000000_add_tracking_to_company 2>/dev/null; npx prisma migrate resolve --rolled-back 20260527100000_add_pizza_borders 2>/dev/null; npx prisma migrate resolve --rolled-back 20260527300000_add_complements_beverages_size_config 2>/dev/null; npx prisma migrate resolve --rolled-back 20260528000000_add_product_video 2>/dev/null; npx prisma migrate resolve --rolled-back 20260528200000_add_whatsapp_ai 2>/dev/null; npx prisma migrate resolve --rolled-back 20260529000000_fix_db_sync 2>/dev/null; npx prisma migrate resolve --rolled-back 20260529100000_add_order_type_fields 2>/dev/null; npx prisma migrate resolve --rolled-back 20260530000000_add_sort_order 2>/dev/null; npx prisma migrate resolve --rolled-back 20260530120000_add_white_label_theme 2>/dev/null; npx prisma migrate resolve --rolled-back 20260530170000_pizza_size_config_to_text 2>/dev/null; npx prisma migrate resolve --rolled-back 20260601000000_fix_company_plan_default 2>/dev/null; npx prisma migrate resolve --rolled-back 20260601100000_add_demo_role 2>/dev/null; npx prisma migrate resolve --rolled-back 20260601200000_add_company_archived 2>/dev/null; npx prisma migrate resolve --rolled-back 20260601300000_add_plan_config 2>/dev/null; npx prisma migrate resolve --rolled-back 20260608000000_add_neighborhood_to_order 2>/dev/null; npx prisma migrate resolve --rolled-back 20260608100000_add_order_number_enum_indexes 2>/dev/null; npx prisma migrate resolve --rolled-back 20260613100000_add_integration_client_id 2>/dev/null; npx prisma migrate resolve --rolled-back 20260613300000_add_order_settings 2>/dev/null; npx prisma migrate resolve --rolled-back 20260621000000_add_financial_settings 2>/dev/null; npx prisma migrate resolve --rolled-back 20260621100000_add_whatsapp_ai_personality 2>/dev/null; npx prisma migrate resolve --rolled-back 20260622000000_add_layout_templates 2>/dev/null; npx prisma migrate resolve --rolled-back 20260623000000_add_wallet_engine 2>/dev/null; npx prisma migrate resolve --rolled-back 20260624000000_add_sidebar_config 2>/dev/null; npx prisma migrate resolve --rolled-back 20260624200000_add_inscricao_estadual 2>/dev/null; npx prisma migrate resolve --rolled-back 20260625000000_add_page_visits 2>/dev/null; npx prisma migrate deploy && node dist/main"]
