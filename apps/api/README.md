# apps/api

Backend NestJS + TypeScript (API REST versionada `/api/v1`).

**Status:** banco de dados (FASE 2), backend + autenticação (FASE 3), catálogo — instrumentos,
cursos, módulos e aulas (FASE 4), controle de acesso + progresso (FASE 5), assinaturas/pagamentos
(FASE 6), player de vídeo — resolução de URL assinada (FASE 7) e lives (FASE 9) implementados.
Metrônomo/afinador (FASE 8) virou `packages/music-tools` — não tem nenhuma superfície de backend.
Notificações e o painel administrativo chegam nas fases seguintes; o player/live embutidos de
verdade (HLS.js/`react-native-video`) só existem quando `apps/admin`/`apps/mobile` forem criados
(decisões 26/30).

## Banco de dados (Prisma) — FASE 2

- `prisma/schema.prisma` — schema completo (usuários, RBAC, catálogo musical, progresso, lives,
  assinaturas, pagamentos, notificações, auditoria, tokens de verificação).
- `prisma/migrations/20260824160000_init/` — migration inicial.
- `prisma/migrations/20260824170000_auth_tokens/` — migration 2 (FASE 3): tabela
  `verification_tokens` + índice único em `refresh_tokens.token_hash` (ver
  `docs/ARCHITECTURE.md`, decisão 12).
- `prisma/migrations/20260824180000_gateway_customer_id/` — migration 3 (FASE 6): coluna
  `users.gateway_customer_id` (ver `docs/ARCHITECTURE.md`, decisão 22).
- `prisma/migrations/20260824190000_live_session_stream_ref_unique/` — migration 4 (FASE 9):
  `live_sessions.stream_ref` vira `@unique` (ver `docs/ARCHITECTURE.md`, decisão 29).
- `prisma/seed.ts` — popula os 3 instrumentos, os papéis (student/teacher/admin), 3 usuários de
  **desenvolvimento**, um plano + assinatura `ACTIVE` de teste, um curso de exemplo publicado e uma
  live de exemplo agendada.

Prisma está fixado em `6.12.0` — motivo em `docs/ARCHITECTURE.md`, decisão 7.

## Backend e autenticação — FASE 3

Módulos implementados em `src/`:

- **auth** — registro, login, refresh (com rotação), logout, logout-all, troca de senha,
  esqueci/redefinir senha, confirmação de e-mail. JWT de acesso curto + refresh token
  híbrido (JWT + hash persistido para revogação) — decisão 8.
- **users** — `GET /users/me`.
- **common** — guard JWT global (rotas públicas via `@Public()`), guard de RBAC (`@Roles()`),
  filtro global de exceções (resposta padronizada, sem stack trace em produção), interceptor de
  resposta (`{ success, data }`).
- **mail** — abstração `MailService`; implementação de dev loga no console (decisão 11).
- **audit** — grava ações sensíveis em `audit_logs` (login, troca de senha, reset, etc.).
- **health** — `GET /health` (liveness) e `GET /ready` (checa conexão com o Postgres).
- **config** — validação de variáveis de ambiente na inicialização (`class-validator`).

Endpoints (`/api/v1/...` exceto `/health` e `/ready`):

| Método | Rota                            | Auth                                       |
| ------ | ------------------------------- | ------------------------------------------ |
| POST   | `/auth/register`                | público                                    |
| POST   | `/auth/login`                   | público                                    |
| POST   | `/auth/refresh`                 | público (usa o refresh token)              |
| POST   | `/auth/logout`                  | público (revoga o refresh token informado) |
| POST   | `/auth/logout-all`              | Bearer                                     |
| POST   | `/auth/change-password`         | Bearer                                     |
| POST   | `/auth/forgot-password`         | público                                    |
| POST   | `/auth/reset-password`          | público                                    |
| GET    | `/auth/confirm-email?token=...` | público                                    |
| GET    | `/users/me`                     | Bearer                                     |
| GET    | `/health`                       | público                                    |
| GET    | `/ready`                        | público                                    |

Rate limiting (`@nestjs/throttler`, em memória — decisão 9): 100 req/min globais; 5–10 req/min nos
endpoints de auth mais sensíveis (`register`, `login`, `forgot-password`). Documentação interativa
em `GET /docs` (Swagger, **desabilitado quando `NODE_ENV=production`**).

## Catálogo — instrumentos, cursos, módulos e aulas — FASE 4

Módulos implementados: **instruments**, **courses**, **course-modules** (entidade `Module` do
schema — módulo de curso, não módulo NestJS), **lessons**, **lesson-materials**.

Todos os endpoints exigem Bearer token (nenhum é público — decisão 13 de `docs/ARCHITECTURE.md`).
Visibilidade e propriedade seguem uma única regra, aplicada em cascata pela hierarquia
Instrumento→Curso→Módulo→Aula→Material (decisão 14):

- **admin** vê e gerencia tudo, em qualquer status.
- **teacher** vê/gerencia os próprios cursos (e módulos/aulas/materiais deles) em qualquer status;
  vê o conteúdo de outros professores apenas quando `PUBLISHED` em toda a cadeia (curso, instrumento,
  módulo e aula publicados).
- **student** (ou qualquer outro papel) só vê a cadeia inteira `PUBLISHED`.

Escrita (`POST`/`PATCH`/`DELETE`) exige papel `admin` (instrumentos) ou `admin`/`teacher` dono do
curso (cursos/módulos/aulas/materiais). `DELETE` de curso/módulo/aula publicado retorna `409` — é
preciso arquivar (`status: ARCHIVED`) antes de excluir (decisão 15). Vídeo (`videoProvider`/
`videoRef`) e materiais (`storageKey`) armazenam apenas referências nesta fase — resolução de URL
assinada/playback fica para as fases de storage (FASE 5+) e player (FASE 7).

Endpoints (`/api/v1/...`, todos com Bearer):

| Método           | Rota                           | Escrita restrita a       |
| ---------------- | ------------------------------ | ------------------------ |
| GET/POST         | `/instruments`                 | POST: admin              |
| GET/PATCH/DELETE | `/instruments/:id`             | admin                    |
| GET              | `/instruments/slug/:slug`      | —                        |
| GET/POST         | `/courses`                     | POST: admin/teacher      |
| GET/PATCH/DELETE | `/courses/:id`                 | admin/teacher dono       |
| GET              | `/courses/slug/:slug`          | —                        |
| GET/POST         | `/courses/:courseId/modules`   | POST: admin/teacher dono |
| GET/PATCH/DELETE | `/course-modules/:id`          | admin/teacher dono       |
| GET/POST         | `/modules/:moduleId/lessons`   | POST: admin/teacher dono |
| GET/PATCH/DELETE | `/lessons/:id`                 | admin/teacher dono       |
| GET/POST         | `/lessons/:lessonId/materials` | POST: admin/teacher dono |
| GET/PATCH/DELETE | `/lesson-materials/:id`        | admin/teacher dono       |

Listagens aceitam paginação (`page`, `limit`, padrão 20, máx. 100) e filtros por status/nível/busca
conforme o recurso — ver `GET /docs` (Swagger) para o contrato completo de cada DTO.

## Controle de acesso e progresso — FASE 5

Módulos implementados: **access-control**, **progress**.

`AccessControlService.hasActiveEntitlement(userId)` decide se um usuário tem uma assinatura
`ACTIVE`/`TRIALING` vigente, lendo a tabela `user_subscriptions` já modelada na FASE 2. A criação
real de assinaturas (checkout, gateway, webhook) é da FASE 6 — por enquanto o estado é atribuído
manualmente (ver seed) ou via `PATCH` direto no banco/admin. Decisão 17 em `docs/ARCHITECTURE.md`.

Com base nisso:

- **Materiais de aula** (`lesson-materials`, FASE 4) passam a exigir assinatura ativa para quem não
  gerencia o curso — admin/professor dono continuam com acesso total (decisão 18). Metadado de
  catálogo (`instruments`/`courses`/`course-modules`/`lessons`) **não** foi alterado — continua só
  exigindo autenticação (decisão 13).
- **Progresso do aluno** (`progress`) grava `watched_seconds`/`last_position_seconds` por aula,
  exigindo o mesmo gate de assinatura (ou ser dono/admin) para gravar. Leitura do próprio progresso
  não exige assinatura (é inofensiva e normalmente vazia se nunca houve acesso). `watched_seconds`
  nunca regride (usa o maior valor já visto) e a aula é marcada concluída automaticamente ao
  atingir 90% da duração cadastrada — decisão 19.

Endpoints (`/api/v1/...`, todos com Bearer):

| Método | Rota                                   | Observação                                          |
| ------ | -------------------------------------- | --------------------------------------------------- |
| GET    | `/access/me`                           | `{ hasActiveEntitlement }` do usuário autenticado   |
| GET    | `/lessons/:lessonId/progress`          | progresso do usuário na aula (não exige assinatura) |
| PUT    | `/lessons/:lessonId/progress`          | upsert de `watchedSeconds`/`lastPositionSeconds`    |
| POST   | `/lessons/:lessonId/progress/complete` | marca a aula como concluída manualmente             |
| GET    | `/courses/:courseId/progress`          | resumo agregado (por módulo/aula) do curso          |

## Assinaturas e pagamentos — FASE 6

Módulos implementados: **subscription-plans**, **payments**, **subscriptions**.

- **`subscription-plans`** — CRUD de planos (`name`, `priceCents`, `currency`, `interval`
  `month`/`year`, `trialDays`, `status`), no mesmo padrão de `instruments` (admin escreve; demais
  papéis só veem `PUBLISHED`).
- **`payments`** — `PaymentGateway` (interface abstrata: `createCustomer`, `createSubscription`,
  `cancelSubscription`, `verifySignature`, `mapWebhookEvent` — decisão 20) e
  `PaymentsService.processWebhookEvent()`, o único ponto que escreve
  `user_subscriptions.status`/`payment_invoices` — nunca o checkout diretamente (decisão 21).
  Idempotência por constraint única `(gateway, eventId)` em `payment_webhook_events`.
- **`subscriptions`** — `POST /subscriptions/checkout` (cria/reaproveita cliente no gateway, cria a
  assinatura local como `INCOMPLETE` e drena os eventos que o gateway simulado "enviaria"
  assincronamente), `POST /subscriptions/cancel`, `GET /subscriptions/me`.

**Somente `PAYMENT_PROVIDER=fake` está implementado nesta fase** (`FakePaymentGateway`, no mesmo
espírito de `ConsoleMailService` — decisão 11): não chama nenhuma API externa, aprova toda
assinatura instantaneamente e loga a ação (`[DEV PAYMENTS] ...`). Ele nunca escreve estado
diretamente — enfileira eventos normalizados e os processa através do mesmo
`PaymentsService.processWebhookEvent()` que a rota pública de webhook usaria com um gateway real,
preservando a regra da seção 7 do prompt-mestre ("o estado real de uma assinatura só muda por
webhook, nunca por resposta do frontend") mesmo em desenvolvimento. Um provedor real (Stripe/
Asaas/Pagar.me) entra depois implementando a mesma interface, sem mudar `SubscriptionsService`/
`PaymentsService`.

Endpoints (`/api/v1/...`):

| Método | Rota                         | Auth                                     |
| ------ | ---------------------------- | ---------------------------------------- |
| GET    | `/subscription-plans`        | Bearer (admin filtra por status)         |
| GET    | `/subscription-plans/:id`    | Bearer                                   |
| POST   | `/subscription-plans`        | admin                                    |
| PATCH  | `/subscription-plans/:id`    | admin                                    |
| DELETE | `/subscription-plans/:id`    | admin                                    |
| POST   | `/subscriptions/checkout`    | Bearer — `{ planId }`                    |
| POST   | `/subscriptions/cancel`      | Bearer                                   |
| GET    | `/subscriptions/me`          | Bearer                                   |
| POST   | `/payments/webhook/:gateway` | público (assinatura verificada no corpo) |
| GET    | `/payments/invoices/me`      | Bearer                                   |

> **Limitação conhecida:** `POST /payments/webhook/:gateway` recebe o corpo já parseado pelo
> `ValidationPipe`/body parser padrão do Nest e o reserializa (`JSON.stringify`) antes de verificar
> a assinatura. Isso é suficiente para o `FakePaymentGateway` (que nunca passa por essa rota — ele
> alimenta `processWebhookEvent` diretamente em processo) mas **não** é suficiente para um gateway
> real baseado em HMAC sobre o corpo bruto (ex. Stripe): a re-serialização não é byte-a-byte igual
> ao corpo original. Antes de plugar um gateway real, esta rota precisa de captura de raw body
> (`bodyParser: false` + middleware dedicado nesta rota, conforme a documentação do NestJS).

## Player de vídeo — FASE 7

Módulos implementados: **video** (`VideoProvider` + `FakeVideoProvider`), **playback**.

`GET /lessons/:id/playback` resolve a URL de reprodução de uma aula (`videoRef` → URL HLS
assinada, de curta duração), aplicando exatamente a mesma regra de acesso de materiais/progresso —
agora centralizada em `AccessControlService.assertEntitled()` (decisão 24, extraída depois da
terceira duplicação): quem gerencia o curso sempre pode gerar a URL; qualquer outro usuário precisa
de assinatura ativa. Aula sem `videoRef` cadastrado retorna `409`.

**Somente `VIDEO_PROVIDER=fake` está implementado nesta fase** (`FakeVideoProvider`, mesmo padrão
de `FakePaymentGateway`/`ConsoleMailService` — decisão 25): nunca chama nenhuma API externa, gera
uma URL fictícia assinada por HMAC com expiração de `VIDEO_PLAYBACK_URL_TTL_SECONDS` (padrão 600s)
e loga a ação (`[DEV VIDEO] ...`). Um provedor real (Mux/AWS IVS/YouTube Live) entra depois
implementando a mesma interface, sem mudar `PlaybackService`.

**Escopo desta fase é só o backend** (decisão 26): o player embutido de verdade — HLS.js/Video.js
no admin, `expo-av`/`react-native-video` no mobile, controles (play/pause/seek/volume/fullscreen/
velocidade 0.5x–2x) e o **loop A-B** (inteiramente client-side por design — seção 10 do
prompt-mestre, não depende do backend) — só existe quando `apps/admin` (FASE 11) e `apps/mobile`
(FASE 10) forem de fato scaffolded. Este endpoint é exatamente o que esses futuros players vão
consumir.

Endpoint (`/api/v1/...`, Bearer):

| Método | Rota                    | Observação                                                |
| ------ | ----------------------- | --------------------------------------------------------- |
| GET    | `/lessons/:id/playback` | `{ lessonId, provider, url, expiresAt }`; `409` sem vídeo |

## Lives — FASE 9

Módulos implementados: **live-provider** (`LiveProvider` + `FakeLiveProvider`), **live-sessions**.

CRUD de `live_sessions` no mesmo padrão de propriedade de `courses` (`isOwnerOrAdmin` — decisão 28:
admin sempre; professor só a própria live). Sem conceito de rascunho/publicação (diferente do
catálogo) — qualquer usuário autenticado vê todas as lives, em qualquer status; só a ação de
assistir (`playback`) exige assinatura ativa ou ser o dono/admin (mesmo `AccessControlService.
assertEntitled` da decisão 24).

Máquina de estados `SCHEDULED → LIVE → FINISHED | CANCELED` (`assertValidLiveStatusTransition`,
testada isoladamente) — só acessível via 3 endpoints de ação, nunca por `PATCH` genérico de status:

- `POST /live-sessions/:id/go-live` — chama `LiveProvider.createLiveStream()`, grava
  `streamRef`/`playbackUrl`, muda status para `LIVE`.
- `POST /live-sessions/:id/end` — chama `LiveProvider.endLiveStream()`, muda status para
  `FINISHED`. A transição de status é **síncrona** (decisão do professor, não precisa de
  confirmação externa); só a gravação (`recordingRef`) é assíncrona de verdade — vinculada depois
  via `POST /live-sessions/webhook/:provider`, mesmo padrão de assinatura/idempotência do webhook
  de pagamentos (decisão 21), mas sem tabela de log de eventos (uma live só tem um `recordingRef`
  para sobrescrever, não uma sequência de faturas) — decisão 30.
- `POST /live-sessions/:id/cancel` — só permitido a partir de `SCHEDULED`.

`GET /live-sessions/:id/playback` devolve a URL certa conforme o status: `LIVE` → o `playbackUrl`
já armazenado (estável durante a transmissão); `FINISHED` com `recordingRef` → resolve uma URL
assinada de curta duração via `LiveProvider.resolveRecordingPlaybackUrl()` (mesma ideia de
`playback` de aula gravada, FASE 7); `SCHEDULED`/`CANCELED`/`FINISHED` sem gravação ainda → `409`.

**Somente `LIVE_PROVIDER=fake` está implementado nesta fase** (`FakeLiveProvider`, mesmo padrão de
`FakePaymentGateway`/`FakeVideoProvider`): nunca chama nenhuma API externa; ao encerrar uma live,
enfileira o evento `recording.ready` que um provedor real enviaria minutos depois, processado pelo
mesmo `processRecordingWebhook()` que a rota pública usaria.

Endpoints (`/api/v1/...`):

| Método | Rota                               | Auth                                       |
| ------ | ---------------------------------- | ------------------------------------------ |
| GET    | `/live-sessions`                   | Bearer                                     |
| GET    | `/live-sessions/:id`               | Bearer                                     |
| POST   | `/live-sessions`                   | admin/teacher                              |
| PATCH  | `/live-sessions/:id`               | admin/teacher dono                         |
| DELETE | `/live-sessions/:id`               | admin/teacher dono (não `LIVE`/`FINISHED`) |
| POST   | `/live-sessions/:id/go-live`       | admin/teacher dono                         |
| POST   | `/live-sessions/:id/end`           | admin/teacher dono                         |
| POST   | `/live-sessions/:id/cancel`        | admin/teacher dono                         |
| GET    | `/live-sessions/:id/playback`      | Bearer (dono/admin ou assinatura ativa)    |
| POST   | `/live-sessions/webhook/:provider` | público (assinatura verificada no corpo)   |

### Como rodar

```bash
cd apps/api
cp .env.example .env          # ajuste DATABASE_URL e troque JWT_SECRET/JWT_REFRESH_SECRET
npm install                   # (se ainda nao rodou na raiz do monorepo)
npm run prisma:migrate:dev    # aplica as migrations num banco vazio
npm run prisma:seed           # popula instrumentos, papeis, usuarios de dev, plano/assinatura
                               # ACTIVE do aluno, um curso de exemplo publicado e uma live agendada
npm run start:dev             # sobe a API em http://localhost:3000 (Swagger em /docs)
```

> **Nota de ambiente:** este projeto foi desenvolvido em uma sandbox sem PostgreSQL nem acesso de
> rede de saída disponíveis. O que **foi** verificado de fato: `prisma validate`/`generate`,
> `tsc --noEmit`, `nest build` (gera `dist/main.js` funcional), lint limpo, `prettier --check` limpo,
> os 57 testes unitários (`npm test`) e um teste adicional que resolve o grafo de DI do `AppModule`
> inteiro sem precisar de Postgres (`app.module.smoke.spec.ts`) — todos passando. Foi esse último
> teste que revelou e permitiu corrigir um bug real de conversão de `PORT` (decisão 23 em
> `docs/ARCHITECTURE.md`) que impediria o boot da API em qualquer ambiente real. O que **não** foi
> possível verificar aqui: subir a API contra um Postgres real e exercitar os endpoints (auth,
> catálogo, progresso, checkout/webhook, playback, lives) ponta a ponta — ao tentar, o processo
> trava indefinidamente na conexão TCP do Prisma (a sandbox bloqueia a rede em vez de recusar a
> conexão, então nem timeout aparece). Rode os comandos acima no seu ambiente para validar o fluxo
> completo antes de seguir para a próxima fase.

Credenciais de desenvolvimento criadas pelo seed (senha única: `Dev@12345`):

| Papel         | E-mail                      |
| ------------- | --------------------------- |
| Aluno         | `aluno.dev@example.com`     |
| Professor     | `professor.dev@example.com` |
| Administrador | `admin.dev@example.com`     |

### Testes

```bash
npm test
```

57 testes unitários: `RolesGuard` (RBAC), `resolveErrorBody` (garante que erros internos não vazam
detalhe em produção), `catalog-visibility.util` (regras puras de propriedade/publicação do
catálogo, FASE 4, incluindo `isOwnerOrAdmin` reaproveitada por lives — decisão 28),
`AccessControlService` (regra de entitlement e `assertEntitled`, FASE 5/7), `env.validation`
(coerção/validação de variáveis de ambiente), `date-interval.util` e `FakePaymentGateway` (FASE 6),
`FakeVideoProvider` (FASE 7), `live-status-transition.util` e `FakeLiveProvider` (FASE 9), mais o
smoke test de DI do `AppModule`.

## Testes de integração — FASE 12

`test/*.e2e-spec.ts` cobre os fluxos de auth, catálogo (visibilidade/propriedade) e assinaturas/
progresso/playback contra um **Postgres real** (não mockado) — bootstrap completo do `AppModule`
via `@nestjs/testing`, requisições HTTP reais via `supertest`, banco truncado e os papéis
`student`/`teacher`/`admin` recriados antes de cada arquivo de teste (`test/utils/reset-database.ts`).

```bash
cp .env.test.example .env.test.local   # ajuste DATABASE_URL para um banco DESCARTAVEL
# suba um Postgres so para isto, ex.:
docker run --rm -p 5433:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=edtech_musical_test postgres:16
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/edtech_musical_test?schema=public npx prisma migrate deploy
npm run test:integration
```

**Nunca** aponte `.env.test.local` para o mesmo banco do `.env` de desenvolvimento — os testes
truncam todas as tabelas entre arquivos. `resetDatabase()` se recusa a rodar se o nome do banco não
terminar em `_test`, exatamente para tornar esse erro difícil de cometer por acidente (ver decisão
correspondente em `docs/ARCHITECTURE.md`, FASE 12).

Cobertura: registro/login/refresh (com rotação)/logout/RBAC (`auth.e2e-spec.ts`); visibilidade e
propriedade do catálogo — DRAFT invisível a aluno, professor não-dono bloqueado, publicação em
cadeia (`catalog-access.e2e-spec.ts`); checkout com aprovação instantânea do `FakePaymentGateway`,
cancelamento, idempotência de webhook por `(gateway, eventId)` (`subscriptions.e2e-spec.ts`); gate
de entitlement em progresso/playback, monotonicidade do progresso, conclusão automática aos 90%
assistidos (`progress-playback.e2e-spec.ts`).

O teste E2E cross-app (os 8 fluxos completos do aluno, do cadastro ao cancelamento, rodando por HTTP
contra a API real como um cliente de verdade faria) fica em `tests/e2e/` na raiz do monorepo — ver
`tests/e2e/README.md`.

**O que foi verificado nesta sandbox:** `tsc --noEmit` limpo (incluindo `test/**/*.ts`, adicionado
ao `include` de `tsconfig.json` — `tsconfig.build.json` continua excluindo `test/` do build de
produção), `eslint`/`prettier` limpos. **Não foi possível rodar de fato** — esta sandbox não tem
acesso a Postgres nem Docker. Rode os comandos acima no seu ambiente antes de seguir para a próxima
fase.

## Estrutura atual

```
src/
  app.module.ts / main.ts
  auth/                controller, service, token service, strategies, dto
  users/               controller, service
  instruments/         CRUD de instrumentos (FASE 4)
  courses/             CRUD de cursos (FASE 4)
  course-modules/      CRUD de modulos de curso (entidade Module) (FASE 4)
  lessons/             CRUD de aulas (FASE 4)
  lesson-materials/    CRUD de materiais de aula (FASE 4, gate de assinatura na FASE 5)
  access-control/      AccessControlService (entitlement) + GET /access/me (FASE 5)
  progress/            progresso do aluno por aula/curso (FASE 5)
  subscription-plans/  CRUD de planos de assinatura (FASE 6)
  payments/            PaymentGateway (interface), FakePaymentGateway, PaymentsService,
                       webhook (FASE 6)
  subscriptions/       checkout, cancelamento, GET /subscriptions/me (FASE 6)
  video/               VideoProvider (interface), FakeVideoProvider (FASE 7)
  playback/            GET /lessons/:id/playback (FASE 7)
  live-provider/       LiveProvider (interface), FakeLiveProvider (FASE 9)
  live-sessions/       CRUD, go-live/end/cancel, playback, webhook de gravacao (FASE 9)
  common/              guards, filters, interceptors, decorators, types, utils (paginacao, slug,
                       visibilidade do catalogo/propriedade)
  mail/                MailService (abstrato) + ConsoleMailService
  audit/               AuditService (audit_logs)
  health/              GET /health, GET /ready
  config/              validacao de env
  prisma/              PrismaService/PrismaModule (global)
prisma/                schema.prisma, migrations, seed
test/                  testes de integracao contra Postgres real (FASE 12) - ver secao acima
```

Ainda faltam (fases seguintes): materiais protegidos com URL assinada de verdade
(`LessonMaterialsService` ainda expõe só `storageKey`, sem `StorageProvider`), `notifications`,
adapters reais de `PaymentGateway`/`VideoProvider`/`LiveProvider`.
