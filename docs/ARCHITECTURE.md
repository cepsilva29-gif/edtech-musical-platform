# ARCHITECTURE.md — Plataforma EdTech Musical Multi-Instrumentos

Este documento registra as decisões arquiteturais tomadas na **FASE 1** e serve de referência
para todas as fases seguintes. Para o modelo de dados completo e as estratégias por área
(auth, pagamentos, streaming, player, metrônomo, afinador, segurança, testes, deploy), ver
`docs/00-primeira-entrega.md`.

Cada decisão é registrada como: **decisão → motivo → alternativas consideradas → impacto futuro**.

---

## 1. Monorepo com npm workspaces

- **Decisão:** um único repositório com `apps/{api,admin,mobile}` e `packages/{shared,config}`,
  orquestrado por `npm workspaces` (sem ferramenta de build adicional por enquanto).
- **Motivo:** API, admin e mobile compartilham tipos/contratos de DTO e regras de validação;
  monorepo evita duplicação e permite refatorar um contrato de API em um único PR que atualiza
  todos os consumidores. `npm workspaces` já vem com o Node/npm instalado — zero ferramenta extra
  para o time aprender nesta fase.
- **Alternativas consideradas:** múltiplos repositórios (rejeitado: duplicaria tipos e dificultaria
  manter contratos de API sincronizados); Turborepo/Nx (rejeitado por agora — overengineering
  para o tamanho atual do projeto; pode ser adotado depois se o tempo de build/CI justificar,
  sem quebrar a estrutura de pastas já definida).
- **Impacto futuro:** se o monorepo crescer a ponto de builds ficarem lentos, dá para introduzir
  cache de build (Turborepo/Nx) sem reestruturar diretórios, pois `apps/`/`packages/` já seguem a
  convenção que essas ferramentas esperam.

## 2. Backend único em NestJS, clientes múltiplos

- **Decisão:** uma única API REST versionada (`/api/v1`) em NestJS/TypeScript é a fonte de verdade
  para todas as regras de negócio; admin e mobile são apenas consumidores HTTP.
- **Motivo:** controle de acesso a conteúdo pago e confirmação de pagamento **precisam** viver no
  backend (regras 16 e 37 do prompt-mestre); centralizar em uma API evita duplicar essa lógica em
  dois clientes com o risco de divergência/falha de segurança.
- **Alternativas consideradas:** BFF (Backend for Frontend) separado por cliente (rejeitado nesta
  fase: adiciona uma camada de rede e complexidade operacional sem necessidade real hoje);
  GraphQL (rejeitado: REST é suficiente para o padrão de consumo do catálogo/progresso/assinaturas
  e mantém a curva de aprendizado baixa; nada na arquitetura impede introduzir GraphQL depois como
  camada adicional se necessário).
- **Impacto futuro:** se um cliente futuro precisar de um formato de resposta muito diferente
  (ex. app TV), um BFF pode ser adicionado na frente da API sem alterar os módulos de domínio.

## 3. Abstração de integrações externas por interface

- **Decisão:** pagamentos (`PaymentGateway`), storage (`StorageProvider`) e vídeo/streaming
  (`VideoProvider`/`LiveProvider`) são acessados sempre através de uma interface definida no
  domínio, nunca diretamente pelo SDK do provedor fora dessa camada.
- **Motivo:** requisito explícito do prompt-mestre (seções 8, 9, 11, 14) — não travar o produto a
  Stripe, Mux, S3 etc. Também reduz o raio de impacto de uma troca de fornecedor a um único
  adapter.
- **Alternativas consideradas:** integração direta do SDK do provedor nos services de domínio
  (rejeitado: espalha detalhes de um fornecedor por todo o sistema, dificultando troca e testes —
  violaria a regra 14 do prompt).
- **Impacto futuro:** trocar de gateway de pagamento ou provedor de vídeo se resume a implementar
  uma nova classe que satisfaz a interface e trocar a configuração (`PAYMENT_PROVIDER`,
  `VIDEO_PROVIDER`); nenhum módulo de domínio precisa mudar.

## 4. Node.js — versão de desenvolvimento vs. produção

- **Decisão:** faixa suportada `>=20 <25` (`package.json engines`); `.nvmrc` fixa **20.11.0**
  (LTS) como versão recomendada para Docker/CI/produção. A máquina de desenvolvimento atual roda
  **Node v24.19.0**, que é compatível com a stack (NestJS, Prisma, Next.js, Expo) nesta fase.
- **Motivo:** regra de compatibilidade do prompt-mestre (seção 35) exige verificar a versão antes
  de gerar código. Node 24 funciona hoje, mas pinar produção em uma LTS (20) reduz risco de quebra
  por mudanças em versões "current" do Node, que não têm o mesmo compromisso de estabilidade.
- **Alternativas consideradas:** exigir Node 24 em todo lugar (rejeitado: 24 não é LTS, aumenta
  risco de incompatibilidade futura com dependências que ainda não suportam Node "current");
  travar em Node 18 (rejeitado: EOL mais próximo, sem ganho real).
- **Impacto futuro:** ao gerar os `Dockerfile`s na FASE 13, a imagem base deve usar
  `node:20-alpine` (ou LTS vigente na época), independentemente da versão local do desenvolvedor.

## 5. Tooling compartilhado na raiz (TypeScript, ESLint, Prettier)

- **Decisão:** `tsconfig.base.json`, `.eslintrc.cjs` e `.prettierrc` na raiz definem a baseline
  (strict mode, regras comuns); cada app (`apps/api`, `apps/admin`, `apps/mobile`) estende essa
  base e sobrepõe o que for específico do seu framework (ex. Next.js usa `moduleResolution`
  diferente; Expo/RN tem preset próprio de babel/eslint).
- **Motivo:** consistência de qualidade de código entre os três apps sem forçar configuração
  idêntica onde os frameworks exigem algo diferente.
- **Alternativas consideradas:** configuração 100% independente por app (rejeitado: gera deriva de
  padrões — ex. um app sem `strict: true`); configuração 100% compartilhada sem override
  (rejeitado: inviável, pois Next.js/Expo têm requisitos de config próprios e não opcionais).
- **Impacto futuro:** nenhum — é o padrão esperado ao criar cada app nas fases seguintes (`extends`
  do `tsconfig.base.json`).

## 6. Redis como dependência condicional, não automática

- **Decisão:** Redis entra na `docker-compose` e no código apenas quando um caso de uso real
  existir (rate limiting, sessão de refresh token em cache, filas) — não é provisionado "por
  padrão" nesta fase.
- **Motivo:** regra 23 do prompt-mestre ("não introduzir Redis sem necessidade real"); evita
  infraestrutura ociosa antes de haver funcionalidade que a use.
- **Alternativas consideradas:** já subir Redis no compose desde a FASE 1 (rejeitado: nenhum
  código o consome ainda, violaria a regra 39 — evitar overengineering).
- **Impacto futuro:** Redis será adicionado ao `docker-compose` junto com o primeiro recurso que
  o exigir (provavelmente rate limiting de login, na FASE 3).

## 7. Prisma fixado em 6.12.0 (não a última major 7.9.1)

- **Decisão:** `prisma`/`@prisma/client` fixados em **6.12.0** (versão exata, sem `^`), mantendo o
  padrão clássico `datasource { url = env("DATABASE_URL") }` — sem driver adapter nem
  `prisma.config.ts`.
- **Motivo:** ao tentar instalar a última major (7.9.1), duas descobertas via teste real (não
  suposição):
  1. Prisma 7 **remove** `url` do bloco `datasource` do `schema.prisma` — a conexão passa a exigir
     um driver adapter (`@prisma/adapter-pg`) instanciado no código e um `prisma.config.ts`
     separado. É uma mudança arquitetural válida, mas adiciona uma camada de configuração sem
     benefício concreto para este projeto agora (regra 39 — evitar overengineering).
  2. `npm audit` acusou **3 vulnerabilidades altas** (`deepmerge-ts` < 8.0.0, stack
     exhaustion/DoS — GHSA-ggr8-5vv4-36mx) presentes em `@prisma/config`, dependência transitiva
     de **toda** versão do Prisma `>= 6.13.0-dev.1`, incluindo a própria 7.9.1. Ou seja, a versão
     mais nova disponível hoje é a que está vulnerável; a correção não depende de qual versão
     "mais atual" se escolhe, e sim de evitar a faixa afetada.
- **Alternativas consideradas:** manter 7.9.1 e conviver com a vulnerabilidade (rejeitado — regra
  38 do prompt-mestre: "se identificar vulnerabilidade, corrija antes de continuar"); usar a
  última 6.x (6.19.3) (rejeitado — testado via `npm view`, ainda depende de
  `deepmerge-ts@7.1.5`, vulnerável); adotar 7.9.1 mesmo com o driver adapter só para "estar na
  última versão" (rejeitado — não compensa herdar a vulnerabilidade nem a complexidade extra sem
  necessidade real).
- **Impacto futuro:** quando a Prisma Data Platform publicar uma versão (6.x ou 7.x) que atualize
  `deepmerge-ts` para `>= 8.0.0`, reavaliar o upgrade — nesse momento decidir também se vale migrar
  para o modelo de driver adapter do Prisma 7. Até lá, `npm audit` deve continuar limpo; se voltar
  a acusar algo nesta dependência, tratar antes de prosseguir para a próxima fase.

## 8. Refresh token: JWT assinado + persistido (hash) para revogação

- **Decisão:** o refresh token é um JWT (assinado com `JWT_REFRESH_SECRET`, `sub` + `jti`), mas o
  hash SHA-256 dele também é gravado em `refresh_tokens` com `expiresAt`/`revokedAt`. No refresh,
  a API verifica a assinatura **e** confere no banco que o token não foi revogado/expirado, depois
  marca-o como revogado e emite um novo par (rotação: cada refresh token só serve uma vez).
- **Motivo:** um JWT puro (stateless) não pode ser revogado antes de expirar — se vazar, continua
  válido até o `exp`. Guardar apenas um registro em banco (sem JWT) funciona mas perde a
  verificação de assinatura em memória. O híbrido combina os dois: verificação rápida via
  assinatura + capacidade real de revogar (logout, logout-all, troca de senha).
- **Alternativas consideradas:** refresh token 100% stateless (rejeitado — impossível revogar,
  viola "controle de sessões" da seção 5 do prompt-mestre); refresh token opaco sem JWT (aceitável,
  mas descartado por já termos `JWT_REFRESH_SECRET` nas variáveis de ambiente definidas na FASE 1 —
  o formato híbrido aproveita essa decisão já tomada sem introduzir um terceiro esquema).
- **Impacto futuro:** revogar todas as sessões de um usuário (troca de senha, reset, logout-all) é
  um `updateMany` em `refresh_tokens` — não depende de blocklist externa nem de Redis.

## 9. Rate limiting em memória (`@nestjs/throttler`), não Redis

- **Decisão:** limite de requisições global (100/min) + limites mais estritos em endpoints
  sensíveis (`register`, `login`, `forgot-password`: 5–10/min) via `@nestjs/throttler` com o
  armazenamento padrão em memória do processo.
- **Motivo:** requisito de segurança da seção 18/38 do prompt-mestre, sem violar a decisão 6
  (Redis só quando houver necessidade real). Com uma única instância da API rodando, memória local
  já cumpre o requisito.
- **Alternativas consideradas:** `ThrottlerStorageRedisService` desde já (rejeitado — só importa
  quando a API escalar horizontalmente para múltiplas instâncias, o que ainda não é o caso).
- **Impacto futuro:** ao rodar múltiplas instâncias atrás de um load balancer (FASE 13+), trocar o
  storage do `ThrottlerModule` para Redis é a única mudança necessária — a API de `@Throttle()` nos
  controllers não muda.

## 10. Logs estruturados + correlation id via `nestjs-pino`

- **Decisão:** logger da aplicação inteira é o Pino (via `nestjs-pino`), com JSON estruturado em
  produção e formatação legível (`pino-pretty`) em desenvolvimento; cada requisição recebe um
  `request-id` (do header `x-request-id` ou gerado via `crypto.randomUUID()`), e dados sensíveis
  (`Authorization`, `Cookie`) são redigidos automaticamente dos logs.
- **Motivo:** requisito de observabilidade da seção 27 do prompt-mestre ("logs estruturados",
  "correlation/request ID"), sem construir uma solução própria.
- **Alternativas consideradas:** `Logger` padrão do Nest (rejeitado — não produz JSON estruturado
  nem correlation id de forma nativa); Winston (rejeitado — Pino é mais leve e é a opção
  recomendada oficialmente pelo Nest para alta performance de log).
- **Impacto futuro:** em produção, o JSON do Pino já está pronto para ser coletado por qualquer
  agregador de log (CloudWatch, Loki, Datadog etc.) sem transformação adicional.

## 11. `MailService` abstraído, implementação de console em dev

- **Decisão:** módulo `mail` segue o mesmo padrão da decisão 3 (`PaymentGateway`/`StorageProvider`)
  — uma classe abstrata `MailService` injetada nos serviços de domínio, com uma implementação
  concreta trocável. Hoje só existe `ConsoleMailService` (loga o e-mail em vez de enviar), porque
  nenhuma variável `SMTP_*`/provedor de e-mail foi configurada ainda.
- **Motivo:** confirmação de e-mail e recuperação de senha (seção 5 do prompt-mestre) precisam de
  _algum_ mecanismo de envio para serem testáveis fim a fim, mas configurar um provedor real (SMTP,
  SES, Resend...) sem credenciais reais seria código morto.
- **Alternativas consideradas:** deixar o envio de e-mail como TODO sem nenhuma implementação
  (rejeitado — quebraria o fluxo de registro/reset, que dependem de gerar e "entregar" um token);
  integrar um provedor real agora (rejeitado — não há credenciais/infra de e-mail definidas ainda,
  seria especulativo).
- **Impacto futuro:** plugar um provedor real é trocar o `useClass` em `MailModule` por uma nova
  implementação de `MailService` — nenhum código de `AuthService` muda.

## 12. Nova tabela `verification_tokens` (migration 2)

- **Necessidade:** confirmação de e-mail e recuperação de senha (seção 5) exigem tokens de uso
  único com expiração; a FASE 2 não previu essa tabela porque a estratégia de auth ainda não tinha
  sido implementada.
- **Alteração:** modelo `VerificationToken` (`userId`, `type` — `EMAIL_VERIFICATION` |
  `PASSWORD_RESET`, `tokenHash` único, `expiresAt`, `usedAt`) + índice único adicional em
  `refresh_tokens.token_hash` (necessário para localizar o token por hash no refresh/logout).
- **Migration:** `prisma/migrations/20260824170000_auth_tokens/` (gerada via diff de schema, já
  que a migration 1 nunca foi aplicada a um banco real — ver `apps/api/README.md`).
- **Prisma/serviços atualizados:** `schema.prisma`, `AuthService` (emissão/consumo dos tokens),
  `TokenService` (refresh tokens).
- **Testes:** cobertura unitária adicionada para `RolesGuard` e para a extração de erro do filtro
  global (`resolveErrorBody`) — ambos testáveis sem banco. Fluxos que dependem de Prisma (register/
  login/refresh) ainda não têm teste automatizado; ver limitação de ambiente abaixo.

---

## Compatibilidade verificada nesta fase

| Ferramenta              | Versão local/instalada | Observação                                                              |
| ----------------------- | ---------------------- | ----------------------------------------------------------------------- |
| Node.js                 | v24.19.0               | compatível com a stack; produção fixa em 20 LTS (ver decisão 4)         |
| npm                     | 11.17.0                | suporta workspaces nativamente                                          |
| TypeScript              | ^5.5.4                 | compatível com NestJS 10/11, Next.js 14+, Expo SDK atual, Prisma 6.12.0 |
| Prisma / @prisma/client | 6.12.0 (fixado)        | `npm audit` limpo (0 vulnerabilidades); ver decisão 7                   |

Versões específicas de NestJS e Expo serão fixadas e validadas nas fases em que cada app for de
fato criado (FASE 3 e FASE 10, respectivamente), conforme a regra 35 do prompt-mestre — nenhuma
dessas dependências é instalada "adiantado" sem uso real.
