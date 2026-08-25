# infra/docker

Dockerfiles por serviço (`apps/api/Dockerfile`, `apps/admin/Dockerfile` — ficam junto do código de
cada app, não aqui, para o contexto de build ficar óbvio) e o `docker-compose` de desenvolvimento/
produção deste diretório. FASE 13 do roadmap.

## Como rodar

A partir da **raiz do repo** (os Dockerfiles usam a raiz como contexto de build, para conseguir
copiar `packages/shared`/`packages/music-tools`, que `apps/admin` consome como fonte TS crua):

```bash
docker compose -f infra/docker/docker-compose.yml up --build
docker compose -f infra/docker/docker-compose.yml run --rm migrate   # aplica prisma migrate deploy
```

- API: http://localhost:3000 (Swagger em `/docs`, fora do prefixo `/api/v1`)
- Admin: http://localhost:3001
- Postgres: `localhost:5432` (usuário/senha `postgres`/`postgres`, banco `edtech_musical`)
- Redis: `localhost:6379` — incluído por completude com `docs/00-primeira-entrega.md` (seção 2),
  **nenhum código da API o consome ainda** (dependência condicional, não automática — decisão 6 em
  `docs/ARCHITECTURE.md`).

Para produção, some o overlay `docker-compose.prod.yml` (copie
`infra/docker/.env.prod.example` para `infra/docker/.env.prod` primeiro e preencha os segredos
reais):

```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml \
  --env-file infra/docker/.env.prod up -d --build
```

## Design

- **Multi-stage**: cada Dockerfile tem uma etapa `deps` (instala as dependências do monorepo,
  hoisted na raiz — workspaces npm não suportam instalar só um workspace sem risco de divergir do
  lockfile), uma etapa `build` (compila só o app-alvo) e uma etapa `runtime` enxuta (só o build
  final + `node_modules` de produção, sem o restante do monorepo).
- `apps/admin/Dockerfile` usa o [output `standalone`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
  do Next.js — imagem final não carrega o `node_modules` inteiro, só o que o Next efetivamente
  rastreou como usado.
- `apps/api/Dockerfile` **não** roda `prisma migrate deploy` no `CMD` do container — isso fica para
  o serviço `migrate` (mesma imagem, comando sobrescrito), rodado manualmente como etapa de release
  antes de subir uma versão nova, conforme `docs/00-primeira-entrega.md` (seção 15). Rodar migration
  automaticamente no start de cada réplica criaria uma corrida entre múltiplas réplicas tentando
  migrar o mesmo banco ao mesmo tempo.
- `HEALTHCHECK` de `apps/api` chama `GET /ready` (verifica conexão real com o Postgres, não só "o
  processo está de pé" — ver `apps/api/src/health/health.controller.ts`).

## O que foi verificado nesta sandbox

`docker-compose.yml`/`docker-compose.prod.yml` foram revisados manualmente (sintaxe YAML,
referências entre serviços, variáveis de ambiente). **O `docker build`/`docker run` em si não pôde
ser executado** — esta sandbox não tem o daemon do Docker instalado (`docker`/`docker compose` não
existem aqui). Uma peça específica de risco foi conferida mesmo assim: `apps/admin/Dockerfile`
assume que a saída `standalone` do Next preserva o caminho `apps/admin/server.js` (por detectar a
raiz do monorepo automaticamente) — rodando `npm run build` localmente (fora do Docker, mas com o
mesmo Next/config), `.next/standalone/apps/admin/server.js` de fato existe nesse caminho exato,
confirmando que o `COPY`/`CMD` do Dockerfile apontam para o lugar certo. O que **não** pôde ser
confirmado é o comportamento dentro do container Linux/Alpine em si (ex. binários nativos como
`sharp`, que o Next rastreia por plataforma — a build local aqui rodou em Windows, então o container
vai rastrear/instalar os binários Linux correspondentes por conta própria durante o `npm ci` dentro
da imagem, mas isso não foi observado de fato rodando). Rode `docker compose -f
infra/docker/docker-compose.yml up --build` no seu ambiente antes de usar em produção.
