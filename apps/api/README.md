# apps/api

Backend NestJS + TypeScript (API REST versionada `/api/v1`).

**Status:** banco de dados (FASE 2), backend + autenticação (FASE 3), catálogo — instrumentos,
cursos, módulos e aulas (FASE 4) e controle de acesso + progresso (FASE 5) implementados.
Assinaturas/pagamentos, lives e player chegam nas fases seguintes.

## Banco de dados (Prisma) — FASE 2

- `prisma/schema.prisma` — schema completo (usuários, RBAC, catálogo musical, progresso, lives,
  assinaturas, pagamentos, notificações, auditoria, tokens de verificação).
- `prisma/migrations/20260824160000_init/` — migration inicial.
- `prisma/migrations/20260824170000_auth_tokens/` — migration 2 (FASE 3): tabela
  `verification_tokens` + índice único em `refresh_tokens.token_hash` (ver
  `docs/ARCHITECTURE.md`, decisão 12).
- `prisma/seed.ts` — popula os 3 instrumentos, os papéis (student/teacher/admin) e 3 usuários de
  **desenvolvimento**.

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

### Como rodar

```bash
cd apps/api
cp .env.example .env          # ajuste DATABASE_URL e troque JWT_SECRET/JWT_REFRESH_SECRET
npm install                   # (se ainda nao rodou na raiz do monorepo)
npm run prisma:migrate:dev    # aplica as 2 migrations num banco vazio
npm run prisma:seed           # popula instrumentos, papeis, usuarios de dev, plano/assinatura
                               # ACTIVE do aluno e um curso de exemplo publicado
npm run start:dev             # sobe a API em http://localhost:3000 (Swagger em /docs)
```

> **Nota de ambiente:** este projeto foi desenvolvido em uma sandbox sem PostgreSQL nem acesso de
> rede de saída disponíveis. O que **foi** verificado de fato: `prisma validate`/`generate`,
> `tsc --noEmit`, `nest build` (gera `dist/main.js` funcional), lint limpo, `prettier --check` limpo
> e os 18 testes unitários (`npm test`) — todos passando. O que **não** foi possível verificar aqui:
> subir a API contra um Postgres real e exercitar os endpoints (auth, catálogo e progresso) ponta a
> ponta — ao tentar, o processo trava indefinidamente na conexão TCP do Prisma (a sandbox bloqueia a rede em
> vez de recusar a conexão, então nem timeout aparece). Rode os comandos acima no seu ambiente para
> validar o fluxo completo antes de seguir para a FASE 6.

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

18 testes unitários: `RolesGuard` (RBAC), `resolveErrorBody` (garante que erros internos não vazam
detalhe em produção), `catalog-visibility.util` (regras puras de propriedade/publicação do
catálogo, FASE 4) e `AccessControlService` (regra de entitlement, FASE 5). Testes de integração
para os fluxos de auth/catálogo/progresso (contra um Postgres real) ficam para a FASE 12, conforme
o roadmap do prompt-mestre.

## Estrutura atual

```
src/
  app.module.ts / main.ts
  auth/              controller, service, token service, strategies, dto
  users/             controller, service
  instruments/       CRUD de instrumentos (FASE 4)
  courses/           CRUD de cursos (FASE 4)
  course-modules/    CRUD de modulos de curso (entidade Module) (FASE 4)
  lessons/           CRUD de aulas (FASE 4)
  lesson-materials/  CRUD de materiais de aula (FASE 4, gate de assinatura na FASE 5)
  access-control/    AccessControlService (entitlement) + GET /access/me (FASE 5)
  progress/          progresso do aluno por aula/curso (FASE 5)
  common/            guards, filters, interceptors, decorators, types, utils (paginacao, slug,
                     visibilidade do catalogo)
  mail/              MailService (abstrato) + ConsoleMailService
  audit/             AuditService (audit_logs)
  health/            GET /health, GET /ready
  config/            validacao de env
  prisma/            PrismaService/PrismaModule (global)
prisma/              schema.prisma, migrations, seed
```

Ainda faltam (fases seguintes): `live-sessions`, `subscriptions` (checkout/gateway real),
`payments`, `storage` (URL assinada real), `notifications`, `admin`.
