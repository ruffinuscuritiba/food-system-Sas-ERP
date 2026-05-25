# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifests primeiro (aproveita cache de camadas)
COPY package*.json ./
COPY prisma ./prisma/

# Instala todas as dependências (incluindo devDeps para compilar)
RUN npm ci

# Gera o Prisma Client
RUN npx prisma generate

# Copia o código-fonte e compila
COPY . .
RUN npm run build

# Remove devDependencies do node_modules
RUN npm prune --omit=dev

# ── Stage 2: Produção ───────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Apenas o necessário para rodar
COPY --from=builder /app/dist           ./dist
COPY --from=builder /app/node_modules   ./node_modules
COPY --from=builder /app/prisma         ./prisma
COPY package*.json ./

# Diretório de uploads locais (fallback quando não há Cloudinary)
RUN mkdir -p /app/uploads

EXPOSE 3000

# Roda migrations e inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
