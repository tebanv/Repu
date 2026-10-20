# Front-user (Next.js 16 + pnpm) — imagen de producción
# Build:  docker build -t repu-front --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=... .
# Run:    docker run -p 3000:3000 repu-front
# Compose (recomendado en servidor): cp .env.example .env && docker compose up -d --build
# Nota: las vars NEXT_PUBLIC_* se incrustan en el build (van como ARG).

FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
  PNPM_HOME="/pnpm" \
  PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /app

# ---- Deps: instala solo con los manifiestos para aprovechar la caché de capas ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build: compila Next.js en modo standalone ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Args de build (NEXT_PUBLIC_* quedan embebidas en el bundle cliente).
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
  NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm build

# ---- Runner: imagen mínima con server.js autocontenido + usuario no-root ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
