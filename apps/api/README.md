# apps/api

Backend NestJS + TypeScript (API REST versionada `/api/v1`).

**Status:** o schema de banco (Prisma), a migration inicial e o seed já existem (**FASE 2**). O
projeto NestJS em si (módulos, guards, controllers, filtro global de erros etc.) é criado na
**FASE 3 (Backend e autenticação)**.

## Banco de dados (Prisma) — FASE 2

- `prisma/schema.prisma` — schema completo com as 19 entidades do modelo de dados (usuários,
  RBAC, catálogo musical, progresso, lives, assinaturas, pagamentos, notificações, auditoria).
- `prisma/migrations/20260824160000_init/migration.sql` — migration inicial, gerada pela própria
  engine do Prisma (`prisma migrate diff --from-empty`), não escrita à mão.
- `prisma/seed.ts` — popula os 3 instrumentos (Cordas, Teclado/Piano, Bateria), os papéis
  (student/teacher/admin) e 3 usuários de **desenvolvimento** (aluno/professor/admin).

Prisma está fixado em `6.12.0` (não a última major) — motivo documentado em
`docs/ARCHITECTURE.md`, decisão 7 (a versão mais nova disponível hoje carrega uma vulnerabilidade
conhecida em uma dependência transitiva).

### Como rodar

Requer um PostgreSQL acessível (ainda não há `docker-compose` — isso é FASE 13; para desenvolver
agora, use uma instância local ou um Postgres gerenciado).

```bash
cd apps/api
cp .env.example .env        # ajuste DATABASE_URL se necessário
npm install                 # (se ainda não rodou na raiz do monorepo)
npm run prisma:migrate:dev  # aplica a migration inicial num banco vazio
npm run prisma:seed         # popula instrumentos, papéis e usuários de dev
```

> **Nota de ambiente:** este projeto foi desenvolvido em um ambiente sem Docker/PostgreSQL
> disponíveis. `prisma validate`, `prisma generate`, a geração da migration inicial e o
> type-check do `seed.ts` foram executados e passaram; **a aplicação da migration e o seed contra
> um banco real ainda não foram executados de fato** — rode os dois comandos acima no seu ambiente
> para confirmar antes de seguir para a FASE 3.

Credenciais de desenvolvimento criadas pelo seed (senha única: `Dev@12345`):

| Papel         | E-mail                      |
| ------------- | --------------------------- |
| Aluno         | `aluno.dev@example.com`     |
| Professor     | `professor.dev@example.com` |
| Administrador | `admin.dev@example.com`     |

## Estrutura planejada (FASE 3+)

```
src/
  modules/   auth, users, instruments, courses, lessons, progress,
             live-sessions, subscriptions, payments, notifications, admin, storage
  common/    guards, filters, interceptors, decorators
  config/    carregamento/validação de env
  health/    GET /health, GET /ready
prisma/      schema.prisma, migrations, seed   ← já existe (FASE 2)
test/        unit / integration / e2e
```
