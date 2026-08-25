# Plataforma EdTech Musical Multi-Instrumentos

Plataforma de ensino musical por assinatura (Cordas, Teclado/Piano, Bateria — extensível a novos
instrumentos), com aulas gravadas, progresso, lives, metrônomo, afinador e assinaturas
recorrentes.

Documentação completa da arquitetura e das estratégias por área (auth, pagamentos, streaming,
player, metrônomo, afinador, segurança, testes, deploy) está em:

- [`docs/00-primeira-entrega.md`](docs/00-primeira-entrega.md) — visão geral, modelo de dados,
  estratégias e roadmap.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — decisões arquiteturais (decisão / motivo /
  alternativas / impacto).

## Estrutura do monorepo

```
apps/
  api/          Backend NestJS + TypeScript (FASE 3+)
  admin/        Painel administrativo Next.js (FASE 11)
  mobile/       App do aluno React Native/Expo (FASE 10)
packages/
  shared/       Tipos/DTOs compartilhados entre api/admin/mobile (populado na FASE 10, ampliado na FASE 11)
  config/       Schemas de validação de variáveis de ambiente
  music-tools/  Motores de metrônomo e afinador — estado/algoritmo puros (FASE 8)
infra/
  docker/       docker-compose (dev/produção); Dockerfiles ficam em apps/api e apps/admin (FASE 13)
  nginx/        Reverse proxy de produção (FASE 13)
docs/           Documentação técnica e de arquitetura
tests/e2e/      Testes ponta-a-ponta cross-app (FASE 12)
```

Cada pasta ainda vazia tem um `README.md` explicando o que será criado nela e em qual fase — não
há nenhum arquivo "fictício" além dessas explicações.

## Requisitos

- Node.js `>=20 <25` (recomendado: 20 LTS — ver `.nvmrc`; ambiente de desenvolvimento atual roda
  v24.19.0, compatível nesta fase)
- npm `>=10`

## Como executar (estado atual — FASE 14, roadmap completo)

```bash
npm install
npm run lint
npm run format:check
```

API (banco de dados + backend/autenticação + catálogo + controle de acesso/progresso +
assinaturas/pagamentos + player de vídeo + lives) — ver `apps/api/README.md` para o passo a passo
completo, endpoints e limitações verificadas:

```bash
cd apps/api
cp .env.example .env          # ajuste DATABASE_URL e troque os segredos JWT_*
npm run prisma:migrate:dev
npm run prisma:seed
npm run start:dev             # http://localhost:3000 (Swagger em /docs)
```

App do aluno (React Native + Expo — aponte para a API acima; ver `apps/mobile/README.md`):

```bash
cd apps/mobile
cp .env.example .env          # ajuste EXPO_PUBLIC_API_URL se a API nao estiver em localhost:3000
npm start
```

Painel administrativo/professor (Next.js — aponte para a API acima; ver `apps/admin/README.md`):

```bash
cd apps/admin
cp .env.example .env.local    # ajuste NEXT_PUBLIC_API_URL se a API nao estiver em localhost:3000
npm run dev                   # http://localhost:3000 (ou a porta livre seguinte)
```

Motores de metrônomo/afinador (sem servidor, sem banco — ver `packages/music-tools/README.md`):

```bash
npm test --workspace=music-tools
```

Testes de integração (contra Postgres real — ver `apps/api/README.md`, seção "Testes de
integração") e o teste E2E cross-app dos 8 fluxos principais (contra a API rodando — ver
`tests/e2e/README.md`) exigem um banco descartável e não foram executados nesta sandbox (sem acesso
a Postgres/Docker aqui); ambos os READMEs documentam exatamente como rodá-los.

Stack inteira via Docker (Postgres + Redis + API + admin — ver `infra/docker/README.md` para o
overlay de produção com nginx):

```bash
docker compose -f infra/docker/docker-compose.yml up --build
docker compose -f infra/docker/docker-compose.yml run --rm migrate   # prisma migrate deploy
```

## Roadmap

| Fase | Escopo                         | Status                      |
| ---- | ------------------------------ | --------------------------- |
| 1    | Arquitetura geral              | ✅ concluída                |
| 2    | Banco de dados e Prisma        | ✅ concluída                |
| 3    | Backend e autenticação         | ✅ concluída                |
| 4    | Cursos, módulos e aulas        | ✅ concluída                |
| 5    | Controle de acesso e progresso | ✅ concluída                |
| 6    | Assinaturas e pagamentos       | ✅ concluída                |
| 7    | Player de vídeo                | ✅ concluída                |
| 8    | Metrônomo e afinador           | ✅ concluída                |
| 9    | Lives                          | ✅ concluída                |
| 10   | Aplicativo mobile              | ✅ concluída                |
| 11   | Painel administrativo          | ✅ concluída                |
| 12   | Testes                         | ✅ concluída                |
| 13   | Docker e produção              | ✅ concluída                |
| 14   | Auditoria final                | ✅ concluída (esta entrega) |

## Status do projeto e limitações conhecidas

As 14 fases do roadmap estão concluídas. Antes de considerar isto pronto para produção de verdade,
leia com atenção:

- **Provedores de pagamento/vídeo/live são simulações (`fake`), não integrações reais.** O contrato
  (`PaymentGateway`/`VideoProvider`/`LiveProvider`) e o pipeline de webhook são os mesmos que um
  provedor real usaria — só falta escrever o adapter concreto (Stripe/Asaas/Pagar.me, Mux/AWS IVS,
  etc.) e trocar a variável de ambiente correspondente (`PAYMENT_PROVIDER`/`VIDEO_PROVIDER`/
  `LIVE_PROVIDER`). Ver decisões 3/17/20/25 em `docs/ARCHITECTURE.md`.
- **Nada de banco de dados, Docker ou rede externa foi executado nesta sandbox de desenvolvimento.**
  Todo teste que depende de Postgres real (integração de `apps/api`, E2E de `tests/e2e`) e todo
  Docker/CI (`infra/`, `.github/workflows/ci.yml`) foi escrito e verificado por `tsc`/`eslint`/
  `prettier`/build, mas **não** executado de fato — cada README relevante documenta exatamente como
  rodar essas verificações no seu ambiente. Rode-as antes de um deploy real.
- **Auditoria de segurança final (FASE 14)** revisou o código contra o checklist de
  `docs/00-primeira-entrega.md` (seção 13) e corrigiu duas lacunas reais: ações administrativas
  sensíveis (promover/rebaixar papel, bloquear/reativar conta) não geravam log de auditoria, e a
  configuração de CORS tinha uma opção não usada e tecnicamente inválida (`credentials: true` com
  origem `*`). Ver decisões 57-59 em `docs/ARCHITECTURE.md` para o checklist completo e o que ficou
  documentado como débito técnico conhecido (não escondido) em vez de corrigido.
- **TLS não está configurado** — `infra/nginx` escuta HTTP puro de propósito (ver
  `infra/nginx/README.md`); um certificado real depende do ambiente de deploy.

Cada `README.md` de cada app/pacote também documenta, na sua própria seção "O que foi verificado
nesta sandbox", exatamente o que foi e não foi possível testar de fato ali.
