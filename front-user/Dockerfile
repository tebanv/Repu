# ==========================================
# ETAPA 1: Construcción (Build)
# ==========================================
FROM node:22-alpine AS builder

# Habilita pnpm en la imagen
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

# Copiamos solo los archivos necesarios para instalar dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Instalamos dependencias con lockfile y permisos seguros
RUN pnpm install --frozen-lockfile --unsafe-perm

# Copiamos el resto del proyecto
COPY . .

# Generamos la build de Next.js
RUN pnpm build

# ==========================================
# ETAPA 2: Ejecución (Runtime)
# ==========================================
FROM node:22-alpine AS runner

# Rehabilitamos pnpm para el contenedor final
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copiamos solo lo preciso desde la etapa builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

# Inicia la app en producción
CMD ["pnpm", "start"]