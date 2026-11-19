# Backend de UTalk (ver docs/backend-y-colas.md). Lo usa Render
# (render.yaml), pero no depende de él: sirve en cualquier hosting con Docker.
#
# Se construye desde la raíz del monorepo (render.yaml lo hace así) porque
# necesita el package-lock.json de la raíz y @utalk/shared. Del mobile solo
# entra su package.json (npm lo pide para validar el lockfile); sus
# dependencias no se instalan.
#
# Node 22: ejecuta directo los .ts de @utalk/shared (que no se compila), así
# que la versión tiene que ser 22.18 o más nueva.

FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/

# 1. Compilar, con las dependencias de desarrollo (Nest CLI, TypeScript).
FROM base AS build
RUN npm ci --workspace apps/backend --workspace packages/shared
COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN npm run build --workspace apps/backend

# 2. Imagen final: solo dependencias de producción y lo compilado.
FROM base AS runtime
ENV NODE_ENV=production
RUN npm ci --workspace apps/backend --workspace packages/shared --omit=dev \
  && npm cache clean --force
COPY packages/shared/src packages/shared/src
COPY --from=build /app/apps/backend/dist apps/backend/dist
WORKDIR /app/apps/backend
USER node
# El hosting pasa el puerto en PORT (Render usa 10000); 3000 es el default.
EXPOSE 3000
CMD ["node", "dist/main.js"]
