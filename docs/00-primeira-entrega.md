# Primeira Entrega — Plataforma EdTech Musical Multi-Instrumentos

> Conforme regras 40/41 do prompt-mestre: nenhum código de implementação é gerado nesta entrega.
> Este documento cobre exclusivamente arquitetura, modelo de dados e estratégias. Aguardar
> autorização explícita para iniciar a FASE 1.

## 1. Visão geral da arquitetura

Sistema desacoplado em 3 aplicações cliente/servidor consumindo uma API única versionada:

- **API (NestJS + TypeScript)** — fonte única de verdade para regras de negócio, autorização,
  progresso, assinaturas e pagamentos. Tudo que decide "o usuário pode ou não" vive aqui — nunca
  no frontend.
- **Admin Web (Next.js + React + TypeScript)** — painel administrativo/professor.
- **Mobile (React Native + Expo + TypeScript)** — app do aluno (Android/iOS), consumindo a mesma
  API.

Persistência em **PostgreSQL** via **Prisma ORM**. **Redis** apenas onde há necessidade real
(rate limiting, cache de catálogo, filas). Vídeo e arquivos **nunca** no banco — apenas
referências/URLs assinadas para um storage S3-compatible e um provedor de vídeo/streaming
abstraído por interface, para não travar o produto a um único fornecedor (Mux, AWS IVS,
YouTube Live, S3/R2).

Pagamentos seguem o mesmo princípio de abstração: uma interface `PaymentGateway` com
implementações concretas (`StripeGateway`, `AsaasGateway`, `PagarmeGateway`) selecionadas por
variável de ambiente. O estado real de uma assinatura só muda por confirmação de backend/webhook
— nunca por sinal do frontend.

## 2. Diagrama textual dos componentes

```
                            ┌───────────────────────┐
                            │        Clientes        │
                            │  Admin (Next.js)  Mobile│
                            │        (Expo/RN)        │
                            └───────────┬─────────────┘
                                        │ HTTPS / REST (/api/v1)
                                        ▼
                    ┌───────────────────────────────────────┐
                    │              API (NestJS)               │
                    │  ┌─────────┐ ┌─────────┐ ┌───────────┐ │
                    │  │  Auth   │ │ Catálogo│ │ Progresso │ │
                    │  ├─────────┤ ├─────────┤ ├───────────┤ │
                    │  │Assinat. │ │Pagamentos│ │   Lives   │ │
                    │  ├─────────┤ ├─────────┤ ├───────────┤ │
                    │  │Notific. │ │  Admin  │ │  Storage  │ │
                    │  └─────────┘ └─────────┘ └───────────┘ │
                    │     Guards RBAC · Interceptors ·        │
                    │     Filtro global de erros · Swagger    │
                    └───────┬───────────┬───────────┬─────────┘
                            │           │           │
                 ┌──────────▼──┐ ┌──────▼─────┐ ┌───▼─────────────┐
                 │ PostgreSQL  │ │   Redis    │ │ Filas (async)   │
                 │  (Prisma)   │ │ cache/rate │ │ email/webhook/  │
                 │             │ │  limit/fila│ │ thumbnail/report│
                 └─────────────┘ └────────────┘ └─────────────────┘
                            │
        ┌───────────────────┼────────────────────┬─────────────────┐
        ▼                   ▼                    ▼                 ▼
┌───────────────┐  ┌─────────────────┐  ┌──────────────────┐ ┌───────────────┐
│ Storage S3-    │  │ PaymentGateway   │  │ VideoProvider     │ │ Notificações  │
│ compatible     │  │ (Stripe/Asaas/   │  │ (Mux/AWS IVS/     │ │ (push/e-mail/ │
│ (S3/R2)        │  │  Pagar.me)       │  │  YouTube Live)    │ │  interna)     │
└───────────────┘  └─────────────────┘  └──────────────────┘ └───────────────┘
```

Ferramentas musicais (**metrônomo** e **afinador**) rodam majoritariamente **client-side**
(Web Audio API no admin/preview, engine nativa equivalente no mobile), sem dependência de
round-trip ao backend para precisão de tempo real.

## 3. Estrutura de diretórios

```
apps/
  api/                 # NestJS — backend REST
    src/
      modules/
        auth/
        users/
        instruments/
        courses/
        lessons/
        progress/
        live-sessions/
        subscriptions/
        payments/
        notifications/
        admin/
        storage/
      common/          # guards, filters, interceptors, decorators
      config/          # carregamento/validação de env
      health/          # /health /ready
    prisma/            # schema.prisma, migrations, seed
    test/              # unit/integration/e2e da API
  mobile/              # React Native + Expo
    src/
      screens/
      components/
      features/        # player, metronome, tuner
      services/        # api client, storage local
  admin/               # Next.js
    src/
      app/
      components/
      features/
packages/
  shared/              # tipos/DTOs compartilhados (contratos de API)
  config/              # schemas de env compartilhados (zod)
infra/
  docker/              # Dockerfiles por app
  nginx/               # reverse proxy (prod)
docs/
  ARCHITECTURE.md       # (gerado ao fim da FASE 1)
  00-primeira-entrega.md
tests/
  e2e/                 # fluxos ponta-a-ponta cross-app
```

Justificativa: monorepo por domínio (apps/ + packages/ compartilhados) evita duplicação de tipos
entre API/mobile/admin, mantém baixo acoplamento entre entregáveis e permite build/deploy
independente de cada app.

## 4. Modelo completo de dados (entidades)

| Entidade                 | Campos principais                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                  | id (uuid), name, email (unique), password_hash, status, email_verified_at, last_login_at, created_at, updated_at                                                                                   |
| `roles`                  | id, name (student/teacher/admin)                                                                                                                                                                   |
| `permissions`            | id, resource, action                                                                                                                                                                               |
| `role_permissions`       | role_id, permission_id                                                                                                                                                                             |
| `user_roles`             | user_id, role_id                                                                                                                                                                                   |
| `refresh_tokens`         | id, user_id, token_hash, user_agent, ip, expires_at, revoked_at, created_at                                                                                                                        |
| `instruments`            | id, name, slug (unique), description, icon_url, status, order                                                                                                                                      |
| `courses`                | id, instrument_id, teacher_id, title, slug, description, level (iniciante/intermediario/avancado), image_url, status, order, created_at, updated_at                                                |
| `modules`                | id, course_id, title, description, order, status                                                                                                                                                   |
| `lessons`                | id, module_id, title, description, video_provider, video_ref, duration_seconds, order, status, created_at, updated_at                                                                              |
| `lesson_materials`       | id, lesson_id, type (pdf/cifra/partitura/exercicio), title, storage_key, order                                                                                                                     |
| `student_progress`       | id, user_id, lesson_id, watched_seconds, last_position_seconds, is_completed, completed_at, updated_at — unique(user_id, lesson_id)                                                                |
| `live_sessions`          | id, instrument_id, teacher_id, title, description, scheduled_at, status (scheduled/live/finished/canceled), stream_provider, stream_ref, playback_url, recording_ref, created_at                   |
| `subscription_plans`     | id, name, description, price_cents, currency, interval, trial_days, status, gateway_price_id                                                                                                       |
| `user_subscriptions`     | id, user_id, plan_id, gateway, gateway_subscription_id, status (trialing/active/past_due/canceled/unpaid/incomplete), current_period_start, current_period_end, cancel_at, canceled_at, created_at |
| `payment_invoices`       | id, user_subscription_id, amount_cents, currency, status, gateway_invoice_id, due_date, paid_at, receipt_url                                                                                       |
| `payment_webhook_events` | id, gateway, event_id (unique por gateway), type, payload, status, processed_at, created_at                                                                                                        |
| `notifications`          | id, user_id, type, payload, read_at, created_at                                                                                                                                                    |
| `audit_logs`             | id, user_id (nullable), action, entity, entity_id, metadata (jsonb), ip, created_at                                                                                                                |

Todas as tabelas usam UUID como PK, `created_at`/`updated_at` (timestamps), foreign keys com
`ON DELETE` explícito por caso de uso, e índices nos padrões de consulta mais comuns (ex.:
`lessons(module_id, order)`, `student_progress(user_id, lesson_id)` único,
`user_subscriptions(user_id, status)`, `payment_webhook_events(gateway, event_id)` único).

## 5. Relacionamentos entre entidades

- `instruments` 1—N `courses` 1—N `modules` 1—N `lessons` 1—N `lesson_materials`
- `lessons` 1—N `student_progress` (N por aluno) ← `users` 1—N `student_progress`
- `users` N—N `roles` via `user_roles`; `roles` N—N `permissions` via `role_permissions` (RBAC)
- `users` 1—N `refresh_tokens`
- `users` (papel professor) 1—N `courses` e 1—N `live_sessions`
- `instruments` 1—N `live_sessions`
- `subscription_plans` 1—N `user_subscriptions` ← `users` 1—N `user_subscriptions`
- `user_subscriptions` 1—N `payment_invoices`
- `payment_webhook_events` é independente (log de entrada), correlacionado por
  `gateway_subscription_id`/`gateway_invoice_id` durante o processamento, não por FK rígida
  (o payload pode chegar antes da entidade local existir).

A estrutura Instrumento → Curso → Módulo → Aula é genérica o suficiente para novos instrumentos
sem alteração de schema (item 6 do prompt).

## 6. Estratégia de autenticação

- Cadastro/login com hash de senha via **argon2** (ou bcrypt como fallback), nunca texto puro.
- **JWT de acesso** de vida curta (~15 min) + **refresh token** de vida longa, rotativo, com hash
  armazenado em `refresh_tokens` (nunca o token puro) — permite revogação individual ou "logout
  em todos os dispositivos".
- Confirmação de e-mail e recuperação de senha via token de uso único com expiração, enviados por
  fila assíncrona de e-mail.
- **RBAC**: guard global de autorização checando `roles`/`permissions` do usuário por rota,
  independente do papel (aluno/professor/admin).
- Rate limiting em endpoints sensíveis (login, refresh, recuperação de senha) via Redis.

## 7. Estratégia de assinaturas e pagamentos

- Interface `PaymentGateway` (createCustomer, createSubscription, cancelSubscription,
  mapWebhookEvent, verifySignature) com implementações por provedor, escolhidas via
  `PAYMENT_PROVIDER` — nenhum código específico de gateway fora dessa camada.
- Webhook único por gateway (`POST /api/v1/payments/webhook/:gateway`) que **valida assinatura**,
  grava o evento bruto em `payment_webhook_events` com `event_id` único (idempotência garantida
  por constraint de banco, não por lógica de aplicação) e só então atualiza
  `user_subscriptions`/`payment_invoices`.
- Estado de assinatura **nunca** é considerado confirmado por resposta do frontend — só por
  webhook oficial (regra 37 do prompt).
- Acesso a conteúdo premium sempre revalidado no backend (status da assinatura + plano cobre o
  conteúdo), nunca confiado ao cliente.

## 8. Estratégia de armazenamento de vídeos e materiais

- `StorageProvider` abstraindo S3/Cloudflare R2 (ou outro S3-compatible).
- Banco armazena apenas `storage_key`/referência — nunca binário.
- Materiais protegidos (PDF, cifra, partitura) servidos por **URL assinada de curta duração**,
  gerada sob demanda após validação de acesso (autenticação + assinatura ativa + plano cobre o
  conteúdo).
- Imagens públicas (capa de curso, ícone de instrumento) podem usar URL de CDN direta.

## 9. Estratégia de streaming

- Interface `VideoProvider` para vídeo gravado e `LiveProvider` para transmissão, com
  implementações plugáveis (Mux, AWS IVS, YouTube Live).
- `lessons.video_ref` e `live_sessions.stream_ref` guardam apenas o identificador externo; a URL
  de reprodução (idealmente HLS assinada) é resolvida em tempo de request, respeitando controle
  de acesso.
- `live_sessions.status` segue máquina de estados `scheduled → live → finished | canceled`;
  gravação pós-live é vinculada via webhook do provedor (processamento assíncrono).

## 10. Estratégia do player

- Player web (admin/preview) baseado em HLS.js/Video.js; player mobile com
  `expo-av`/`react-native-video` — ambos consumindo a mesma URL HLS assinada.
- Controles padrão (play/pause/seek/volume/fullscreen/velocidade 0.5x–2x) mapeados para a API
  nativa do player escolhido.
- **Loop A-B**: implementado inteiramente client-side — marca `pointA`/`pointB` em estado local,
  observa o evento de progresso do player (`timeupdate`/equivalente) e reposiciona (`seek`) ao
  atingir B. Não depende do backend; precisão limitada pela granularidade do evento do player
  (tipicamente ~250ms na web), o que é aceitável e deve ser documentado como limite conhecido.

## 11. Estratégia do metrônomo

- Motor abstraído (`MetronomeEngine`) com estado puro (bpm, compasso, subdivisão, acentuação,
  volume, preset) desacoplado da renderização.
- **Web**: técnica de _lookahead scheduling_ com **Web Audio API** — `setInterval`/timer só
  dispara verificações frequentes que **agendam** eventos de áudio usando `AudioContext.currentTime`
  (clock de alta precisão), nunca toca o som diretamente no callback do timer. Isso evita o drift
  característico de `setInterval` puro.
- **Mobile**: equivalente nativo (agendamento via clock de áudio da plataforma, não pelo timer JS
  do React Native, que sofre throttling em background).
- Faixa 40–240 BPM; arquitetura permite evolução para múltiplos compassos, subdivisões, sons e
  presets sem redesenho.

## 12. Estratégia do afinador

- Captura de microfone via `getUserMedia` (web) / API de áudio nativa (mobile).
- Detecção de pitch por **autocorrelação (algoritmo tipo YIN)** sobre o buffer capturado —
  mais robusto que pico de FFT simples para sinal musical monofônico.
- Conversão frequência → nota mais próxima entre as 6 afinações-alvo (E2 A2 D3 G3 B3 E4) e cálculo
  de desvio em cents: `1200 * log2(f / f_alvo)`; tolerância de afinado: **±5 cents**.
- Tratamento de ruído/instabilidade: gate por amplitude/RMS mínima (ignora sinal fraco), score de
  confiança da autocorrelação (rejeita leitura ambígua/ruidosa), suavização por média móvel das
  últimas N leituras antes de exibir resultado — evita "pisca-pisca" da indicação.

## 13. Estratégia de segurança

JWT + refresh rotativo, RBAC em toda rota sensível, hash de senha forte, rate limiting (Redis),
CORS restrito por ambiente, Helmet, validação/sanitização de entrada (class-validator/DTOs),
proteção contra SQL injection (Prisma parametrizado por padrão), autorização sempre revalidada no
backend (nunca confiada ao frontend), logs de auditoria para ações sensíveis, verificação de
assinatura em todo webhook, sem armazenamento de dado de cartão na aplicação (delegado ao
gateway), sem stack trace exposto em produção (filtro global de exceção com resposta padronizada
`{ success, error: { code, message } }`).

## 14. Estratégia de testes

- **Unit**: regras de negócio puras — auth, cálculo de progresso, regras de assinatura, cálculo
  do afinador (cents/pitch), regras do metrônomo (scheduling).
- **Integration**: API + PostgreSQL real (via container efêmero), cobrindo autenticação,
  assinaturas, progresso.
- **E2E**: os 8 fluxos do item 26 (cadastro → login → assinatura → acesso ao curso → reprodução →
  progresso → conclusão → cancelamento), rodando contra a API real.

## 15. Estratégia de deploy

- Dockerfile por serviço (api/admin) + `docker-compose` de desenvolvimento (api, postgres, redis)
  com volumes persistentes.
- Ambientes separados (dev/homologação/produção) via variáveis de ambiente, nunca credenciais em
  código (`.env.example` documentando as chaves).
- CI/CD: lint + testes + build de imagem a cada PR; `prisma migrate deploy` como etapa de release
  antes de subir a nova versão; `GET /health` e `GET /ready` para probes do orquestrador; logs
  estruturados (ex. pino) com correlation/request ID.

## 16. Lista de riscos técnicos

1. **Lock-in de provedor de vídeo/live** — mitigado pela interface `VideoProvider`/`LiveProvider`.
2. **Idempotência de webhook de pagamento** — mitigado por constraint única `(gateway, event_id)`.
3. **Precisão do afinador em ambiente ruidoso** — mitigado por gates de confiança/amplitude;
   limitação deve ser comunicada ao usuário (ex. "sinal fraco").
4. **Drift do metrônomo em mobile** (JS throttling em background) — exige clock de áudio nativo,
   não timer JS puro; validar em dispositivo real, não apenas simulador.
5. **Granularidade do loop A-B** limitada pelo evento de progresso do player (~250ms na web) —
   documentar como limite aceito, não como bug.
6. **Vazamento/pirataria de conteúdo protegido** — mitigado por URLs assinadas de curta duração;
   nunca expor link permanente de vídeo/material premium.
7. **Escala de audiência em live** — depende do provedor escolhido; não hospedar transmissão por
   conta própria.
8. **Expansão internacional** (moeda, i18n) — schema já prevê `currency` desde já para evitar
   migração dolorosa depois.

## 17. Roadmap de implementação

| Fase | Escopo                                               |
| ---- | ---------------------------------------------------- |
| 1    | Arquitetura geral (esta entrega)                     |
| 2    | Banco de dados e Prisma (schema + migrations + seed) |
| 3    | Backend e autenticação                               |
| 4    | Cursos, módulos e aulas                              |
| 5    | Controle de acesso e progresso                       |
| 6    | Assinaturas e pagamentos                             |
| 7    | Player de vídeo                                      |
| 8    | Metrônomo e afinador                                 |
| 9    | Lives                                                |
| 10   | Aplicativo mobile                                    |
| 11   | Painel administrativo                                |
| 12   | Testes                                               |
| 13   | Docker e produção                                    |
| 14   | Auditoria final                                      |

---

**Aguardando autorização para iniciar a FASE 1 (Arquitetura geral / setup do monorepo).**
