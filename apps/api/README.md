# apps/api

Backend NestJS + TypeScript (API REST versionada `/api/v1`).

**Status:** banco de dados (FASE 2) e backend + autenticação (FASE 3) implementados. Módulos de
catálogo/progresso/assinaturas/pagamentos/lives chegam nas fases seguintes.

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

### Como rodar

```bash
cd apps/api
cp .env.example .env          # ajuste DATABASE_URL e troque JWT_SECRET/JWT_REFRESH_SECRET
npm install                   # (se ainda nao rodou na raiz do monorepo)
npm run prisma:migrate:dev    # aplica as 2 migrations num banco vazio
npm run prisma:seed           # popula instrumentos, papeis e usuarios de dev
npm run start:dev             # sobe a API em http://localhost:3000 (Swagger em /docs)
```

> **Nota de ambiente:** este projeto foi desenvolvido em uma sandbox sem PostgreSQL nem acesso de
> rede de saída disponíveis. O que **foi** verificado de fato: `prisma validate`/`generate`,
> `tsc --noEmit`, `nest build` (gera `dist/main.js` funcional), lint limpo e os 8 testes unitários
> (`npm test`) — todos passando. O que **não** foi possível verificar aqui: subir a API contra um
> Postgres real e exercitar os endpoints (`register`/`login`/`refresh`/etc.) ponta a ponta — ao
> tentar, o processo trava indefinidamente na conexão TCP do Prisma (a sandbox bloqueia a rede em
> vez de recusar a conexão, então nem timeout aparece). Rode os comandos acima no seu ambiente para
> validar o fluxo completo antes de seguir para a FASE 4.

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

8 testes unitários cobrindo `RolesGuard` (RBAC) e `resolveErrorBody` (garante que erros internos
não vazam detalhe em produção). Testes de integração para os fluxos de auth (register/login/
refresh contra um Postgres real) ficam para a FASE 12, conforme o roadmap do prompt-mestre.

## Estrutura atual

```
src/
  app.module.ts / main.ts
  auth/        controller, service, token service, strategies, dto
  users/       controller, service
  common/      guards, filters, interceptors, decorators, types
  mail/        MailService (abstrato) + ConsoleMailService
  audit/       AuditService (audit_logs)
  health/      GET /health, GET /ready
  config/      validacao de env
  prisma/      PrismaService/PrismaModule (global)
prisma/        schema.prisma, migrations, seed
```

Ainda faltam (fases seguintes): `instruments`, `courses`, `lessons`, `progress`, `live-sessions`,
`subscriptions`, `payments`, `storage`, `notifications`, `admin`.
