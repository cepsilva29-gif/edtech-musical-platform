# tests/e2e

Teste ponta-a-ponta cross-app: os 8 fluxos principais da plataforma (cadastro, login, assinatura,
acesso ao curso, reprodução da aula, atualização de progresso, conclusão, cancelamento da
assinatura), rodando por HTTP contra um `apps/api` **real e em execução** — não importa nada de
`apps/api/src`, só os contratos publicados em `packages/shared`. FASE 12 do roadmap.

Isso é deliberado (ver decisão correspondente em `docs/ARCHITECTURE.md`, FASE 12): os testes de
integração de `apps/api/test/*.e2e-spec.ts` já cobrem a lógica de negócio com acesso direto ao
Prisma; este pacote existe para ter **pelo menos uma camada que não sabe nada da implementação
interna**, do mesmo jeito que `apps/admin`/`apps/mobile` também só enxergam a API pela fronteira
HTTP pública.

## Como rodar

1. Suba um Postgres descartável (mesmo que os testes de integração de `apps/api`, mas pode ser o
   mesmo banco de desenvolvimento também — este pacote só lê/cria dados via API, nunca truncando
   nada diretamente):

   ```bash
   docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=edtech_musical postgres:16
   ```

2. Suba a API já **seedada** (o seed cria o plano `[DEV] Plano Mensal` e o curso
   `[DEV] Violão para iniciantes` com aulas publicadas e com vídeo associado — ver
   `apps/api/prisma/seed.ts` — sem isso o passo 3/4 falha com uma mensagem explicando o que rodar):

   ```bash
   cd apps/api
   cp .env.example .env
   npm run prisma:migrate:dev
   npm run prisma:seed
   npm run start:dev   # http://localhost:3000
   ```

3. Em outro terminal, rode este pacote (aponta para `http://localhost:3000/api/v1` por padrão;
   ajuste via `API_BASE_URL` se a API estiver em outro host/porta):

   ```bash
   npm run test --workspace=tests/e2e
   ```

## Design

- `src/api-client.ts` — cliente HTTP mínimo (`fetch` nativo do Node 20+, sem nenhuma dependência
  extra), tipado com `packages/shared`. Não reaproveita `apps/admin/src/services/api-client.ts` nem
  `apps/mobile/src/services/api-client.ts` de propósito — cada um tem sua própria estratégia de
  armazenamento de token (localStorage/secure-store) que não faz sentido aqui, e a duplicação de um
  wrapper HTTP tão pequeno não justifica extrair um pacote novo só para isto.
- `src/full-lifecycle.spec.ts` — um único `describe` com 8 `it()` **sequenciais e com estado
  compartilhado** (o token do passo 1-2, o `lessonId` do passo 4 reaproveitado nos passos 5-8) — não
  são 8 testes independentes, é deliberadamente um único fluxo narrado em 8 passos, na ordem que o
  próprio roadmap descreve. O aluno usado é sempre um cadastro novo com e-mail aleatório (nunca o
  `aluno.dev@example.com` do seed, que já nasce com assinatura `ACTIVE` — o seed existe para dar
  dados de catálogo para o passo 4 em diante, não para servir de fixture "em branco" de aluno).

## O que foi verificado nesta sandbox

`tsc --noEmit` e `eslint` limpos. **Não foi possível rodar de fato** — esta sandbox não tem acesso a
Postgres/Docker (mesma limitação já documentada na seção "Testes de integração" de
`apps/api/README.md`). Rode os 3 passos acima no seu ambiente para validar antes de seguir para a
próxima fase.
