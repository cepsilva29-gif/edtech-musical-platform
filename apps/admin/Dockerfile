# syntax=docker/dockerfile:1
#
# Build multi-stage para apps/admin (Next.js, output standalone). Roda a partir da RAIZ do
# monorepo (contexto de build = raiz do repo) - ver infra/docker/docker-compose.yml.

FROM node:20-alpine AS base
WORKDIR /repo

# -----------------------------------------------------------------------------
# deps: mesma logica de apps/api/Dockerfile - instala tudo uma vez, hoisted na raiz.
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/music-tools/package.json packages/music-tools/package.json
COPY tests/e2e/package.json tests/e2e/package.json
RUN npm ci

# -----------------------------------------------------------------------------
# build: `shared`/`music-tools` sao consumidos como fonte TS crua (sem dist proprio - ver
# packages/shared/package.json, "main": "src/index.ts"), entao o build do Next precisa do
# codigo-fonte deles disponivel aqui, nao so do package.json.
# -----------------------------------------------------------------------------
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/music-tools packages/music-tools
COPY apps/admin apps/admin
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
