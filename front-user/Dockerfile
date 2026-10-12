# ==========================================
# ETAPA 1: Construcción (Build)
# ==========================================
FROM node:20-alpine AS builder

# Habilitar pnpm mediante Corepack según la versión definida en package.json
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias
RUN pnpm install

# Copiar el resto del código fuente
COPY . .

# Compilar la aplicación (Next.js build)
RUN pnpm build

# ==========================================
# ETAPA 2: Ejecución (Runtime)
# ==========================================
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copiar los archivos necesarios para producción desde el builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

# Comando de inicio definido en los scripts de producción
CMD ["pnpm", "start"]