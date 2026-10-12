# ==========================================
# ETAPA 1: Construcción (Build)
# ==========================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .
RUN pnpm build

# ==========================================
# ETAPA 2: Ejecución (Runtime)
# ==========================================
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["pnpm", "start"]