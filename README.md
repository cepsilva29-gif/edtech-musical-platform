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

## Como executar (estado atual — FASE 1)

Nesta fase só existe tooling de raiz (lint/format); ainda não há aplicação executável — isso
chega na FASE 3 (API).

```bash
npm install
npm run lint
npm run format:check
```

## Roadmap

| Fase | Escopo                         | Status                      |
| ---- | ------------------------------ | --------------------------- |
| 1    | Arquitetura geral              | ✅ concluída (esta entrega) |
| 2    | Banco de dados e Prisma        | aguardando autorização      |
| 3    | Backend e autenticação         | —                           |
| 4    | Cursos, módulos e aulas        | —                           |
| 5    | Controle de acesso e progresso | —                           |
| 6    | Assinaturas e pagamentos       | —                           |
| 7    | Player de vídeo                | —                           |
| 8    | Metrônomo e afinador           | —                           |
| 9    | Lives                          | —                           |
| 10   | Aplicativo mobile              | —                           |
| 11   | Painel administrativo          | —                           |
| 12   | Testes                         | —                           |
| 13   | Docker e produção              | —                           |
| 14   | Auditoria final                | —                           |
