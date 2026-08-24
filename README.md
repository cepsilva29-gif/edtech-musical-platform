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
  api/       Backend NestJS + TypeScript (FASE 3+)
  admin/     Painel administrativo Next.js (FASE 11+)
  mobile/    App do aluno React Native/Expo (FASE 10+)
packages/
  shared/    Tipos/DTOs compartilhados entre api/admin/mobile
  config/    Schemas de validação de variáveis de ambiente
infra/
  docker/    Dockerfiles e docker-compose (FASE 13+)
  nginx/     Reverse proxy de produção (FASE 13+)
docs/        Documentação técnica e de arquitetura
tests/e2e/   Testes ponta-a-ponta cross-app (FASE 12+)
```

Cada pasta ainda vazia tem um `README.md` explicando o que será criado nela e em qual fase — não
há nenhum arquivo "fictício" além dessas explicações.

## Requisitos

- Node.js `>=20 <25` (recomendado: 20 LTS — ver `.nvmrc`; ambiente de desenvolvimento atual roda
  v24.19.0, compatível nesta fase)
- npm `>=10`

## Como executar (estado atual — FASE 4)

```bash
npm install
npm run lint
npm run format:check
```

API (banco de dados + backend/autenticação + catálogo) — ver `apps/api/README.md` para o passo a
passo completo, endpoints e limitações verificadas:

```bash
cd apps/api
cp .env.example .env          # ajuste DATABASE_URL e troque os segredos JWT_*
npm run prisma:migrate:dev
npm run prisma:seed
npm run start:dev             # http://localhost:3000 (Swagger em /docs)
```

## Roadmap

| Fase | Escopo                         | Status                      |
| ---- | ------------------------------ | --------------------------- |
| 1    | Arquitetura geral              | ✅ concluída                |
| 2    | Banco de dados e Prisma        | ✅ concluída                |
| 3    | Backend e autenticação         | ✅ concluída                |
| 4    | Cursos, módulos e aulas        | ✅ concluída (esta entrega) |
| 5    | Controle de acesso e progresso | aguardando autorização      |
| 6    | Assinaturas e pagamentos       | —                           |
| 7    | Player de vídeo                | —                           |
| 8    | Metrônomo e afinador           | —                           |
| 9    | Lives                          | —                           |
| 10   | Aplicativo mobile              | —                           |
| 11   | Painel administrativo          | —                           |
| 12   | Testes                         | —                           |
| 13   | Docker e produção              | —                           |
| 14   | Auditoria final                | —                           |
