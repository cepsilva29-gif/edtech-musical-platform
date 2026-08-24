# apps/api

Backend NestJS + TypeScript (API REST versionada `/api/v1`).

**Status:** placeholder — o projeto NestJS real (com `prisma/schema.prisma`, módulos de domínio,
guards, filtros globais etc.) é criado na **FASE 3 (Backend e autenticação)**, após o schema de
banco da **FASE 2** existir.

Estrutura planejada (ver `docs/00-primeira-entrega.md` para detalhes):

```
src/
  modules/   auth, users, instruments, courses, lessons, progress,
             live-sessions, subscriptions, payments, notifications, admin, storage
  common/    guards, filters, interceptors, decorators
  config/    carregamento/validação de env
  health/    GET /health, GET /ready
prisma/      schema.prisma, migrations, seed
test/        unit / integration / e2e
```
