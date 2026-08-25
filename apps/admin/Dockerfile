# syntax=docker/dockerfile:1
#
# Build multi-stage para apps/admin (Next.js, output standalone). Roda a partir da RAIZ do
# monorepo (contexto de build = raiz do repo) - ver infra/docker/docker-compose.yml.

FROM node:20-alpine AS base
WORKDIR /repo

# -----------------------------------------------------------------------------
# deps: mesma logica de apps/api/Dockerfile - instala tudo uma vez, hoisted na raiz. apps/admin,
# packages/shared e packages/music-tools entram com o codigo-fonte COMPLETO antes do `npm ci` (nao
# so o package.json) - mesmo achado real de CI documentado em apps/api/Dockerfile: `npm ci` com o
# workspace-alvo ainda incompleto produzia um node_modules que quebrava a resolucao de modulos do
# TypeScript no build seguinte. `shared`/`music-tools` tambem precisam do codigo-fonte aqui porque
# sao consumidos como TS cru pelo Next (sem `dist` proprio - packages/shared/package.json, "main":
# "src/index.ts"). apps/api/apps/mobile/tests/e2e continuam so com o package.json - nao sao
# necessarios como fonte completa para buildar apps/admin.
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin apps/admin
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared packages/shared
COPY packages/music-tools packages/music-tools
COPY tests/e2e/package.json tests/e2e/package.json
RUN npm ci

# -----------------------------------------------------------------------------
# build: fonte completa ja presente da etapa `deps` - so falta buildar.
# -----------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=apps/admin

# -----------------------------------------------------------------------------
# runtime: output standalone do Next ja traz um server.js proprio + so os node_modules realmente
# usados (tracing automatico) - `public/` e `.next/static` precisam ser copiados manualmente (nao
# fazem parte do standalone por design do Next - https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /repo/apps/admin/public ./apps/admin/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/admin/server.js"]
