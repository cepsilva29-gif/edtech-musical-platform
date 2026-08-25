# syntax=docker/dockerfile:1
#
# Build multi-stage para apps/api (NestJS). Roda a partir da RAIZ do monorepo (contexto de build =
# raiz do repo, nao apps/api/) - ver infra/docker/docker-compose.yml, que ja aponta o `context`
# certo. Node 20 LTS (mesma versao fixada para producao - decisao 4 em docs/ARCHITECTURE.md).

FROM node:20-alpine AS base
WORKDIR /repo
# Prisma (query engine) precisa de openssl no Alpine/musl - sem isto o client falha em runtime.
RUN apk add --no-cache openssl

# -----------------------------------------------------------------------------
# deps: instala TODAS as dependencias do monorepo (workspaces npm nao suportam instalar so um
# workspace sem risco de divergir do lockfile - ver docs/ARCHITECTURE.md, decisao da FASE 13).
# apps/api entra com o codigo-fonte COMPLETO (nao so o package.json) - achado real de CI: `npm ci`
# rodando so com os package.json (sem o restante de apps/api presente ainda) produzia um
# node_modules que quebrava a resolucao de modulos do TypeScript ("Cannot find module
# '@nestjs/common'") na etapa de build seguinte. As outras workspaces (admin/mobile/shared/
# music-tools/tests-e2e) continuam so com o package.json - nao sao necessarias como fonte completa
# para buildar apps/api, so para o npm ci reconhecer a estrutura de workspaces do lockfile.
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api apps/api
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/music-tools/package.json packages/music-tools/package.json
COPY tests/e2e/package.json tests/e2e/package.json
RUN npm ci

# -----------------------------------------------------------------------------
# build: gera o Prisma Client e compila o Nest (tsconfig.build.json ja exclui test/ - decisao da
# FASE 12). DATABASE_URL fake so para satisfazer a validacao sintatica do schema.prisma no
# `generate` - nenhuma conexao real acontece nesta etapa.
# -----------------------------------------------------------------------------
FROM deps AS build
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# runtime: so o necessario para rodar - dist/, node_modules ja podado (sem devDependencies),
# schema/migrations do Prisma (para `prisma migrate deploy` rodar como etapa de release separada -
# ver infra/docker/README.md - a imagem NAO roda migrations automaticamente no start, para nao ter
# multiplas replicas competindo pela mesma migration).
# -----------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
WORKDIR /repo/apps/api

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
