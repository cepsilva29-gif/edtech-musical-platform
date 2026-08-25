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

## 13. Catálogo (FASE 4) exige autenticação — sem vitrine pública anônima

- **Decisão:** todos os endpoints de `instruments`/`courses`/`course-modules`/`lessons`/
  `lesson-materials`, inclusive os de leitura, ficam atrás do `JwtAuthGuard` global — nenhum é
  marcado `@Public()`. Qualquer usuário autenticado (aluno, professor ou admin) pode listar/ver
  conteúdo publicado; a visibilidade de rascunho/arquivado é só para o dono ou admin (decisão 14).
- **Motivo:** o prompt-mestre não pede uma página de marketing pré-login nesta fase (a FASE 4 cobre
  "cursos, módulos e aulas", não um site institucional); manter tudo atrás de autenticação evita
  criar dois modos de resposta (anônimo vs. autenticado) para o mesmo endpoint, o que exigiria um
  guard de autenticação opcional só para diferenciar "aluno" de "visitante anônimo" — complexidade
  sem requisito concreto ainda (regra 39 — evitar overengineering).
- **Alternativas consideradas:** guard de autenticação opcional (decodifica o JWT se presente, mas
  não exige) para permitir navegação anônima do catálogo público (rejeitado por ora — nenhum
  requisito de vitrine pública foi definido; adicionar esse guard depois é uma mudança isolada, sem
  afetar as regras de visibilidade já implementadas).
- **Impacto futuro:** se uma landing/vitrine pública for exigida (ex. para SEO/conversão antes do
  cadastro), basta introduzir esse guard opcional e trocar `@Roles()`/ausência de `@Public()` pelos
  endpoints de leitura — a lógica de negócio (`catalog-visibility.util.ts`) não muda, pois já separa
  "pode gerenciar" de "está publicado".

## 14. Visibilidade e propriedade do catálogo centralizadas em um util puro

- **Decisão:** as regras "quem pode gerenciar" (`canManageCourse` — admin ou o professor dono) e
  "o que está visível para quem não gerencia" (`isCoursePublished`/`isModulePublished`/
  `isLessonPublished` — toda a cadeia Instrumento→Curso→Módulo→Aula precisa estar `PUBLISHED`) vivem
  em `common/utils/catalog-visibility.util.ts`, como funções puras sem dependência do Nest/Prisma
  runtime, e são reusadas por `InstrumentsService`, `CoursesService`, `CourseModulesService`,
  `LessonsService` e `LessonMaterialsService`.
- **Motivo:** a hierarquia de 4 níveis repetiria a mesma condição ("published E pai published") em
  cada serviço se não fosse centralizada — risco real de um nível divergir dos outros e vazar
  rascunho de outro professor. Funções puras também são testáveis sem mocks de Prisma/Nest (ver
  `catalog-visibility.util.spec.ts`).
- **Alternativas consideradas:** repetir a checagem em cada service (rejeitado — duplicação com alto
  risco de divergência); um `CaslAbility`/guard de policy genérico (rejeitado — overengineering para
  4 recursos com uma única regra de propriedade; reavaliar se o número de regras crescer nas fases
  de assinatura/pagamento).
- **Impacto futuro:** qualquer novo recurso da hierarquia (ex. quizzes por aula) só precisa de uma
  nova função `isXPublished` seguindo o mesmo padrão encadeado.

## 15. Não é permitido excluir conteúdo `PUBLISHED` — só arquivar

- **Decisão:** `DELETE` em curso/módulo/aula retorna `409 Conflict` se o registro estiver
  `PUBLISHED`; é preciso primeiro fazer `PATCH` para `ARCHIVED` (ou `DRAFT`) e só então excluir.
  Instrumento segue regra parecida, mas por contagem de cursos vinculados (FK `Restrict`).
- **Motivo:** `Course→Module→Lesson→LessonMaterial` usa `onDelete: Cascade` no schema (FASE 2) — uma
  exclusão de curso publicado apagaria em cascata módulos/aulas/materiais e (mais tarde, FASE 5)
  progresso de alunos, sem nenhuma confirmação. Como a API não tem um mecanismo de "confirmar
  exclusão em cascata", a forma mais simples e segura de evitar perda de dado acidental é proibir a
  exclusão direta de algo publicado.
- **Alternativas consideradas:** permitir exclusão direta de qualquer status (rejeitado — risco de
  apagar conteúdo em uso por alunos sem aviso); soft delete (`deletedAt`) em vez de excluir de fato
  (rejeitado por ora — nenhuma outra tabela do schema usa soft delete; introduzir o padrão só para
  este caso seria inconsistente com a FASE 2 já implementada).
- **Impacto futuro:** quando `student_progress` passar a ser populado de verdade (FASE 5), esta regra
  já garante que um curso com alunos ativos não pode ser excluído sem primeiro ser arquivado
  deliberadamente por quem o gerencia.

## 16. Rotas aninhadas "achatadas": coleção aninhada, item no topo

- **Decisão:** listagem/criação usam o caminho aninhado do pai (`GET/POST /courses/:courseId/modules`,
  `GET/POST /modules/:moduleId/lessons`, `GET/POST /lessons/:lessonId/materials`), mas
  leitura/edição/exclusão de um item específico usam um caminho de topo com o próprio id
  (`GET/PATCH/DELETE /course-modules/:id`, `/lessons/:id`, `/lesson-materials/:id`) — sem repetir a
  cadeia inteira de ids pai na URL.
- **Motivo:** UUID já identifica o recurso de forma única; obrigar o cliente a conhecer/enviar
  `courseId` e `moduleId` só para editar uma aula específica (`/courses/:c/modules/:m/lessons/:l`)
  não agrega informação e deixa admin/mobile/app com mais estado para montar a URL.
- **Alternativas consideradas:** aninhamento completo em todos os métodos (rejeitado — verboso sem
  ganho); recursos 100% no nível raiz mesmo para listar (`GET /lessons?moduleId=`) (rejeitado — menos
  explícito que a coleção pertence ao pai, e foge do padrão REST aninhado já natural para
  Instrumento→Curso→Módulo→Aula).
- **Impacto futuro:** nenhum — é só uma convenção de rota; a lógica de propriedade/visibilidade não
  depende de quantos ids aparecem na URL.

## 17. Controle de acesso (FASE 5) consome `user_subscriptions`, mas não cria assinaturas

- **Decisão:** `AccessControlService.hasActiveEntitlement(userId)` consulta a tabela
  `user_subscriptions` (já modelada na FASE 2) procurando um registro `ACTIVE`/`TRIALING` com
  `current_period_end` nulo ou no futuro. Nenhum endpoint desta fase cria, atualiza ou cancela uma
  assinatura — isso é explicitamente escopo da FASE 6 (checkout, gateway, webhooks).
- **Motivo:** a ordem do roadmap coloca "Controle de acesso e progresso" (FASE 5) antes de
  "Assinaturas e pagamentos" (FASE 6). Isso só faz sentido se controle de acesso for entendido como
  "dado um estado de assinatura, decidir o que o usuário pode consumir" — a _leitura_ do
  entitlement — separado de "como esse estado é produzido", que é a integração real com gateway de
  pagamento. O schema já suporta essa leitura desde a FASE 2, então não há necessidade de esperar a
  FASE 6 para implementar a decisão de acesso em si.
- **Alternativas consideradas:** adiar toda a FASE 5 até a FASE 6 existir (rejeitado — inverteria a
  ordem do roadmap sem necessidade real, já que o schema de assinatura já está pronto); implementar
  um mecanismo de acesso paralelo e descartável só para teste (rejeitado — criaria dois caminhos de
  decisão de acesso para depois unificar, risco de divergência).
- **Impacto futuro:** quando a FASE 6 implementar o gateway real e os webhooks, `user_subscriptions`
  passa a ser escrito por um fluxo de pagamento de verdade em vez do seed — `AccessControlService`
  não muda nenhuma linha, pois já lê exatamente esse estado.

## 18. Materiais de aula exigem assinatura ativa; metadado do catálogo continua aberto

- **Decisão:** `lesson-materials` (listagem e detalhe) agora exige, além de o usuário poder ver a
  aula, que `AccessControlService.hasActiveEntitlement` retorne verdadeiro — exceto para quem já
  gerencia o curso (admin/professor dono, que precisa editar materiais independentemente de ter uma
  assinatura própria). Os endpoints de FASE 4 (`instruments`, `courses`, `course-modules`,
  `lessons`) **não** mudaram — continuam exigindo só autenticação, sem checar assinatura.
- **Motivo:** a seção 8 do `docs/00-primeira-entrega.md` já previa isso desde a FASE 1 ("materiais
  protegidos servidos por URL assinada, gerada sob demanda após validação de acesso — autenticação +
  assinatura ativa + plano cobre o conteúdo"); a FASE 4 não podia implementar essa checagem porque o
  mecanismo de acesso ainda não existia. Metadado de curso/aula (título, descrição, duração) segue
  sem gate porque é material de vitrine (decide-se assinar vendo do que se trata), enquanto o
  material de apoio (PDF, cifra, partitura) é o "conteúdo" de fato.
- **Alternativas consideradas:** gatear também a leitura de `lessons`/`courses` (rejeitado —
  reverteria a decisão 13 da FASE 4 sem necessidade, e tornaria impossível ao aluno decidir assinar
  vendo a ementa do curso); esperar a FASE 7 (player) para gatear qualquer coisa (rejeitado — a
  seção 8 já é explícita sobre materiais, e a tabela `lesson_materials` já existe e é servida hoje).
- **Impacto futuro:** quando o `StorageProvider`/URL assinada de fato existir (fora do roadmap
  numerado, mas antecipado na seção 8), a geração da URL entra _depois_ desta checagem — o gate de
  acesso não muda.

## 19. Progresso: métrica monotônica + conclusão automática por percentual assistido

- **Decisão:** `PUT /lessons/:id/progress` nunca reduz `watched_seconds` (usa `Math.max` contra o
  valor já salvo) e marca a aula como concluída automaticamente quando `watched_seconds >= 90%` de
  `duration_seconds` (só quando a duração é conhecida, i.e. `> 0`). Existe também
  `POST /lessons/:id/progress/complete` para marcar conclusão manual (útil quando a duração não foi
  cadastrada, ou o aluno quer se autodeclarar concluído). `completedAt` nunca é sobrescrito depois de
  definido.
- **Motivo:** o player (FASE 7) enviará atualizações de progresso em intervalos, possivelmente fora
  de ordem (retries de rede, múltiplas abas) — sem o `Math.max`, um evento atrasado com um valor
  menor apagaria progresso real já registrado. 90% (não 100%) é o limiar comum de "aula concluída"
  em plataformas de vídeo, absorvendo o fato de que poucos alunos assistem o segundo final exato.
- **Alternativas consideradas:** sempre sobrescrever `watched_seconds` com o valor recebido
  (rejeitado — vulnerável a regressão por evento fora de ordem); exigir 100% para concluir
  (rejeitado — não reflete o comportamento real de consumo de vídeo).
- **Impacto futuro:** quando o player real existir, ele só precisa chamar `PUT .../progress`
  periodicamente com `watchedSeconds`/`lastPositionSeconds` — toda a lógica de conclusão já está no
  backend, nada muda no contrato.

## 20. `PaymentGateway`: interface única, só `FakePaymentGateway` (dev) implementada

- **Decisão:** `createCustomer`/`createSubscription`/`cancelSubscription`/`verifySignature`/
  `mapWebhookEvent` (seção 7) viram uma `abstract class PaymentGateway`, no mesmo espírito de
  `MailService` (decisão 11). A única implementação nesta fase é `FakePaymentGateway`: nunca chama
  rede, aprova toda assinatura instantaneamente e loga a ação (`[DEV PAYMENTS] ...`). Selecionada
  via `PAYMENT_PROVIDER` (default `"fake"`); qualquer outro valor falha no boot com mensagem clara
  (`PaymentsModule`).
- **Motivo:** Stripe/Asaas/Pagar.me exigem credenciais e SDKs reais que não existem nesta sandbox —
  implementar um adapter real seria código morto e não testável (mesmo raciocínio da decisão 11
  para `MailService`). A interface, porém, é o requisito real da seção 7 e não depende de
  credencial nenhuma para existir.
- **Alternativas consideradas:** implementar diretamente o SDK da Stripe já assumindo credenciais
  futuras (rejeitado — regra 39, overengineering sem verificação possível); não ter abstração nenhuma
  e simular tudo direto no `SubscriptionsService` (rejeitado — violaria a decisão 3, acoplando
  regra de negócio a um "provedor" fictício que não pode ser trocado depois sem reescrever
  consumidores).
- **Impacto futuro:** plugar Stripe/Asaas/Pagar.me de verdade é implementar uma nova classe que
  satisfaz `PaymentGateway` e trocar `PAYMENT_PROVIDER` — `SubscriptionsService`/`PaymentsService`
  não mudam. O método opcional `drainSimulatedEvents()` só existe em gateways de simulação; um
  adapter real simplesmente não o implementa (webhooks chegam via HTTP de verdade).

## 21. Webhook é o único escritor de estado de assinatura, mesmo para o gateway fake

- **Decisão:** `PaymentsService.processWebhookEvent()` é o único método que grava
  `user_subscriptions.status`/`payment_invoices` — inclusive para o `FakePaymentGateway`. Em vez de
  o checkout/cancelamento escreverem o estado diretamente, `FakePaymentGateway` enfileira os
  eventos que um gateway real enviaria depois de forma assíncrona; `SubscriptionsService` drena essa
  fila (`drainSimulatedEvents()`) logo após chamar `createSubscription`/`cancelSubscription` e
  alimenta cada evento no mesmo `processWebhookEvent()` que a rota pública
  `POST /payments/webhook/:gateway` usaria. Idempotência por `@@unique([gateway, eventId])` (constraint
  de banco, não `if` de aplicação) — uma tentativa duplicada apenas encontra o registro já existente.
- **Motivo:** regra explícita da seção 7 ("o estado real de uma assinatura só muda por confirmação
  de backend/webhook — nunca por sinal do frontend"). Se o checkout escrevesse `status: ACTIVE`
  diretamente após chamar o gateway fake, o código de desenvolvimento praticaria exatamente o
  padrão proibido, e um dev copiando esse caminho para um gateway real herdaria o bug.
- **Alternativas consideradas:** checkout escreve o status otimisticamente e o webhook só confirma
  depois (rejeitado — é literalmente a regra que a seção 7 proíbe); gateway fake chamando a própria
  rota HTTP `POST /payments/webhook/fake` via loopback (rejeitado — round-trip de rede
  desnecessário dentro do mesmo processo, sem benefício sobre chamar o service diretamente).
- **Impacto futuro:** nenhum consumidor de `AccessControlService`/`ProgressService` (FASE 5) muda —
  eles já liam `user_subscriptions` sem saber como ela é escrita (decisão 17).

## 22. `users.gateway_customer_id` (nova migration) — não previsto na FASE 2

- **Necessidade:** `createCustomer` (seção 7) precisa de um lugar para persistir o id do cliente no
  gateway, para reaproveitar entre assinaturas futuras do mesmo usuário e evitar criar um cliente
  duplicado a cada checkout. O schema da FASE 2 não previu essa coluna porque a estratégia de
  pagamentos ainda não tinha sido implementada.
- **Alteração:** `User.gatewayCustomerId String? @unique` — uma única coluna, não uma tabela à
  parte, porque `PAYMENT_PROVIDER` já é um único provedor ativo por ambiente (decisão 3); não há
  hoje um caso de um mesmo usuário ter clientes simultâneos em gateways diferentes.
- **Migration:** `prisma/migrations/20260824180000_gateway_customer_id/`.
- **Impacto futuro:** se o produto um dia precisar suportar múltiplos gateways simultâneos (ex.
  migração gradual de provedor), essa coluna vira uma tabela `gateway_customers(user_id, gateway,
gateway_customer_id)` — mudança isolada, sem afetar `PaymentGateway`/`SubscriptionsService`.

## 23. Correção: `PORT` do `.env` nunca era convertido de string para número

- **Decisão:** `env.validation.ts` (FASE 3) usava `enableImplicitConversion: true` do
  `class-transformer` sem `@Type(() => Number)` explícito no campo `PORT`. Um teste novo desta fase
  (`app.module.smoke.spec.ts`, que resolve o grafo de DI inteiro do `AppModule` sem precisar de
  Postgres) expôs que essa conversão implícita **não** acontecia de fato: `PORT` chegava como a
  string `"3000"` vinda do `.env`/ambiente, e `@IsInt()` rejeitava, derrubando o boot da API com
  "Configuração de ambiente inválida" — em qualquer ambiente real, não só nesta sandbox. Corrigido
  adicionando `@Type(() => Number)` (a forma robusta e documentada do `class-transformer`, que não
  depende de metadata de tipo refletida corretamente). Teste de regressão em `env.validation.spec.ts`.
  Como nenhum outro campo do `env.validation.ts` é numérico, nenhum outro campo tinha esse risco.
- **Motivo:** este bug nunca foi pego nas fases 3-5 porque a sandbox não tem Postgres, então
  `npm run start:dev` nunca foi executado de fato aqui — só `nest build`/`tsc --noEmit` (que não
  executam `validate()`) e testes unitários que não montavam o `AppModule` inteiro. Reforça o valor
  de um teste de "compilação do grafo de DI" mesmo sem banco disponível.
- **Alternativas consideradas:** confiar de novo em `enableImplicitConversion` (rejeitado — é
  exatamente o que já tinha falhado silenciosamente); remover a validação de tipo de `PORT`
  (rejeitado — perderia a proteção contra um valor de porta inválido em produção).
- **Impacto futuro:** nenhum — é uma correção de bug, não uma mudança de contrato. Serve de lembrete
  para revisar `enableImplicitConversion` com ceticismo ao adicionar novos campos numéricos/boolean
  a `EnvironmentVariables`.

## 24. `AccessControlService.assertEntitled` — regra de consumo centralizada (regra dos 3)

- **Decisão:** o padrão "quem gerencia o curso sempre passa; senão exige assinatura ativa" existia
  duplicado em `LessonMaterialsService` (FASE 5) e `ProgressService` (FASE 5). Ao precisar da mesma
  regra pela terceira vez em `PlaybackService` (FASE 7), ela foi extraída para
  `AccessControlService.assertEntitled(userId, canManage)` — um método puro em relação ao chamador
  (recebe `canManage` já calculado, não importa `LessonsService` nem nenhum módulo de catálogo).
  `LessonMaterialsService`/`ProgressService` foram refatorados para usá-lo, sem mudança de
  comportamento (mesmos testes de FASE 4/5 continuam passando).
- **Motivo:** três ocorrências idênticas da mesma condição é o gatilho clássico para extrair —
  antes disso, duplicar é mais barato que uma abstração errada; depois, duplicar passa a ser risco
  real de divergência (ex. alguém corrige a mensagem de erro em um lugar e esquece os outros dois).
- **Alternativas consideradas:** manter a duplicação também no `PlaybackService` (rejeitado — seria
  a quarta cópia do mesmo `if`); mover a regra para `LessonsService` em vez de
  `AccessControlService` (rejeitado — misturaria "visibilidade de catálogo" com "regra de
  entitlement comercial", duas responsabilidades que já são módulos separados desde a FASE 5).
- **Impacto futuro:** qualquer novo tipo de conteúdo consumível (ex. certificado de conclusão)
  reaproveita `assertEntitled` do mesmo jeito que `PlaybackService` faz.

## 25. `VideoProvider`: interface única, só `FakeVideoProvider` (dev) implementada

- **Decisão:** `resolvePlaybackUrl(videoRef)` (seção 9) vira uma `abstract class VideoProvider`, no
  mesmo espírito de `MailService`/`PaymentGateway` (decisões 11 e 20). A única implementação nesta
  fase é `FakeVideoProvider`: nunca chama rede, gera uma URL HLS fictícia assinada por HMAC com
  expiração curta (`VIDEO_PLAYBACK_URL_TTL_SECONDS`, padrão 600s) e loga a ação
  (`[DEV VIDEO] ...`). Selecionada via `VIDEO_PROVIDER` (default `"fake"`); qualquer outro valor
  falha no boot com mensagem clara (`VideoProviderModule`).
- **Motivo:** Mux/AWS IVS/YouTube Live exigem credenciais reais que não existem nesta sandbox —
  implementar um adapter real seria código morto e não testável, mesmo raciocínio já usado para
  `MailService` (decisão 11) e `PaymentGateway` (decisão 20). A interface, porém, é o requisito real
  da seção 9 e não depende de credencial nenhuma para existir.
- **Alternativas consideradas:** resolver a URL de playback diretamente no `LessonsService`
  (rejeitado — violaria a decisão 3, acoplando o catálogo a um "provedor" fictício); expor
  `videoRef` diretamente ao cliente sem nenhuma URL assinada (rejeitado — contraria a seção 9
  explicitamente, e não prepara o terreno para controle de acesso de conteúdo pago).
- **Impacto futuro:** plugar Mux/AWS IVS/YouTube Live de verdade é implementar uma nova classe que
  satisfaz `VideoProvider` e trocar `VIDEO_PROVIDER` — `PlaybackService` não muda.

## 26. Escopo da FASE 7 fica no backend: URL assinada, não o player embutido

- **Decisão:** esta fase entrega `GET /lessons/:id/playback` (resolve a URL de reprodução,
  respeitando exatamente a mesma regra de acesso de materiais/progresso — decisão 24) e a
  abstração `VideoProvider`. **Não** entrega nenhum código de player embutido (HLS.js/Video.js no
  admin, `expo-av`/`react-native-video` no mobile, loop A-B, controle de velocidade 0.5x–2x —
  seção 10), porque esses componentes vivem em `apps/admin` e `apps/mobile`, que ainda não existem
  no monorepo (roadmap: FASE 11 e FASE 10, respectivamente).
- **Motivo:** a ordem do roadmap coloca "Player de vídeo" (FASE 7) antes de "Aplicativo mobile"
  (FASE 10) e "Painel administrativo" (FASE 11) — só faz sentido lida como "o backend expõe tudo
  que um player vai precisar antes de o player em si existir", análogo ao raciocínio já usado nas
  decisões 17 e 21 para "Controle de acesso" vir antes de "Assinaturas e pagamentos". O loop A-B em
  si é **inteiramente client-side** por design (seção 10: "não depende do backend"), então mesmo
  quando `apps/admin`/`apps/mobile` existirem, ele não terá contraparte de API nenhuma — é lógica
  pura de UI observando o evento de progresso do player escolhido.
- **Alternativas consideradas:** adiar a FASE 7 inteira até `apps/admin`/`apps/mobile` existirem
  (rejeitado — inverteria a ordem do roadmap sem necessidade real, já que a resolução de URL
  assinada é um requisito de backend genuíno e testável isoladamente); escrever um player web
  dentro de `apps/api` só para "ter algo visual" (rejeitado — fora do propósito de uma API REST,
  duplicaria trabalho quando `apps/admin` for scaffolded de verdade).
- **Impacto futuro:** quando `apps/admin`/`apps/mobile` forem criados (FASE 10/11), eles consomem
  `GET /lessons/:id/playback` e implementam loop A-B/controles inteiramente no cliente — nenhuma
  mudança de contrato de API é esperada para isso.

## 27. FASE 8 (metrônomo/afinador) vira um novo pacote (`packages/music-tools`), não `apps/api`

- **Decisão:** metrônomo e afinador (seções 11/12 do prompt-mestre) são descritos como **100%
  client-side** — nenhuma tabela no schema, nenhum endpoint de API. Diferente da FASE 7 (que tinha
  uma fatia de backend genuína — resolução de URL assinada), a FASE 8 não tem nenhum trabalho
  possível em `apps/api`. A parte que **é** possível e valiosa entregar agora — sem depender de
  `apps/admin`/`apps/mobile` existirem — é exatamente a que a própria seção 11 já descreve como
  separada: "motor abstraído... com estado puro... desacoplado da renderização". Essa parte
  (`MetronomeEngine.tick()` como lookahead scheduling puro; `detectPitch()` via YIN sobre um
  `Float32Array`; `matchNearestNote()`/cents; `TunerSmoother`) não depende de Web Audio API,
  `getUserMedia`, DOM ou React Native — só de matemática determinística, 100% testável agora.
- **Motivo:** mesmo raciocínio já usado nas decisões 20/25 (`PaymentGateway`/`VideoProvider`):
  implementar agora o que é genuinamente testável e adiar só a integração que depende de algo que
  ainda não existe (aqui, os apps cliente; lá, credenciais de gateway/vídeo). `packages/shared` foi
  descartado como destino porque seu escopo documentado (`README.md` do pacote,
  `docs/00-primeira-entrega.md` seção 3) é estritamente "tipos/DTOs compartilhados — contratos de
  API"; motor de metrônomo/afinador não é um contrato de API (`apps/api` não tem nenhuma relação
  com esse domínio) — misturar os dois violaria a separação de responsabilidade que o próprio
  `packages/shared` já declara.
- **Alternativas consideradas:** não entregar nada nesta fase até `apps/admin`/`apps/mobile`
  existirem (rejeitado — o motor puro é genuinamente buildável e testável agora, adiar seria deixar
  trabalho real na mesa sem necessidade); colocar o código dentro de `packages/shared` (rejeitado —
  ver motivo acima); criar `apps/admin` ou `apps/mobile` prematuramente só para ter onde colocar o
  motor (rejeitado — antecipar o scaffold de um app inteiro, com todas as decisões de framework que
  isso implica, só para hospedar ~400 linhas de lógica pura, seria overengineering na direção
  oposta: adiantar decisão de FASE 10/11 sem necessidade).
- **Impacto futuro:** quando `apps/admin` (Next.js/Web Audio API) e `apps/mobile` (Expo/áudio
  nativo) forem criados, ambos importam `music-tools` como dependência de workspace e implementam
  só a ponta de I/O (captura de microfone, agendamento real de áudio, UI) — o algoritmo em si não
  muda. Se o afinador precisar suportar outros instrumentos além de violão/guitarra (o "Cordas"
  também cobre isso, mas Teclado/Piano e Bateria não têm um conceito de "afinação por corda"),
  `matchNearestNote()` já aceita um `tuning` alternativo como parâmetro — não precisa mudar a
  assinatura.

## 28. `isOwnerOrAdmin` — renomeado de `canManageCourse`, reaproveitado para lives

- **Decisão:** `canManageCourse(user, course)` foi renomeada para `isOwnerOrAdmin(user, resource)`
  em `catalog-visibility.util.ts` — a lógica ("admin sempre; senão, só quem é `teacherId` dono") é
  idêntica para `Course` e, agora, para `LiveSession` (FASE 9), então em vez de duplicar a função
  com outro nome, o `LiveSessionsService` importa e usa a mesma. Comportamento idêntico, só o nome
  deixou de sugerir que é exclusiva de curso.
- **Motivo:** mesmo raciocínio da decisão 24 (regra dos 3/DRY) aplicado a uma função já existente
  em vez de a um novo método — reutilizar uma função já testada é preferível a escrever
  `isOwnerOrAdmin` do zero em `live-sessions`, e manter o nome antigo (`canManageCourse`) num lugar
  usado por dois domínios diferentes seria confuso para quem ler o código depois.
- **Alternativas consideradas:** copiar a função para dentro de `live-sessions` com outro nome
  (rejeitado — duplicação direta do que a decisão 24 já identificou como problema); manter o nome
  `canManageCourse` e só documentar que também serve para lives (rejeitado — nome enganoso é pior
  que uma renomeação de baixo risco, já que a função só tem 3 usos no código inteiro).
- **Impacto futuro:** qualquer novo recurso com o mesmo formato de propriedade (`{ teacherId }`)
  reaproveita `isOwnerOrAdmin` diretamente.

## 29. `live_sessions.stream_ref` vira `@unique` (nova migration) — não previsto na FASE 2

- **Necessidade:** o webhook de gravação (`POST /live-sessions/webhook/:provider`) precisa
  localizar a live por `streamRef` para gravar o `recordingRef` — e `prisma.liveSession.update()`
  exige um campo único no `where`. O schema da FASE 2 não modelou `stream_ref` como único porque a
  estratégia de webhook de live ainda não tinha sido implementada (mesma situação da decisão 22
  para `users.gateway_customer_id`).
- **Alteração:** `LiveSession.streamRef String? @unique`. Um valor `NULL` (live que nunca foi ao ar)
  não conflita com outro `NULL` — unicidade em Postgres ignora `NULL`s, então múltiplas lives
  `SCHEDULED` sem stream continuam coexistindo sem violar a constraint.
- **Migration:** `prisma/migrations/20260824190000_live_session_stream_ref_unique/`.
- **Impacto futuro:** nenhum — é exatamente o identificador que o provedor real (Mux/AWS IVS/
  YouTube Live) já garante ser globalmente único; a constraint só formaliza no banco uma garantia
  que já existia na prática.

## 30. Transição de status da live só por webhook para a gravação, não para o estado da live

- **Decisão:** `SCHEDULED → LIVE → FINISHED` é decidido **sincronamente** pela ação do professor/
  admin (`POST /live-sessions/:id/go-live` e `.../end`, validados por
  `assertValidLiveStatusTransition` — máquina de estados pura e testada isoladamente). Diferente da
  FASE 6 (onde nem o checkout síncrono pode confirmar uma assinatura), aqui a ação de "comecei a
  transmitir"/"terminei de transmitir" é uma decisão legítima e imediata de quem está no controle
  da live — não há necessidade de esperar confirmação externa para isso. O que **é** assíncrono e
  só pode vir por webhook é a gravação em si (`recordingRef`) — o processamento do vídeo pós-live
  leva tempo no provedor, então `endLive()` só encerra a live; o `POST /live-sessions/webhook/:provider`
  (mesmo padrão de idempotência/assinatura de `PaymentsService.processWebhookEvent`, decisão 21) é
  quem vincula `recordingRef` quando o provedor terminar de processar.
- **Motivo:** distinguir "o que só o dono da live pode decidir, na hora" (ir ao vivo, encerrar) de
  "o que só o provedor externo sabe, depois de um tempo" (a gravação ficou pronta) — aplicando o
  mesmo princípio que orientou a decisão 21 (webhook como fonte de verdade), mas reconhecendo que
  nem toda transição de estado tem a mesma natureza: dinheiro/assinatura exige confirmação externa
  por definição (o servidor não pode saber se o pagamento realmente aconteceu sem o gateway dizer);
  já a "duração de uma transmissão ao vivo" é uma decisão local e imediata do próprio usuário.
- **Alternativas consideradas:** também esperar webhook para confirmar `LIVE`/`FINISHED`
  (rejeitado — não há nada para o provedor "confirmar" aqui que o backend já não saiba com certeza
  a partir da própria chamada da API; adicionaria latência e complexidade sem ganho de correção);
  não ter máquina de estados nenhuma, aceitando qualquer `PATCH` de status (rejeitado — abriria
  brecha para pular etapas, ex. marcar `FINISHED` sem nunca ter passado por `LIVE`).
- **Impacto futuro:** nenhum — quando um provedor real substituir o `FakeLiveProvider`, o contrato
  não muda: `endLiveStream()` continua sendo chamado de forma síncrona pela ação do professor, e
  `processRecordingWebhook()` continua sendo o único ponto que grava `recordingRef`.

## 31. `packages/shared` finalmente populado — data sempre `string`, nunca `Date`

- **Decisão:** cada domínio de `apps/api` (auth, catálogo, progresso, assinaturas, pagamentos,
  playback, lives) ganhou um arquivo espelhado em `packages/shared/src/`, com os tipos exatos de
  request/response — mantidos manualmente em sincronia com os DTOs/services reais (sem geração
  automática nesta fase). Toda propriedade `DateTime` do Prisma é tipada como `string` (nunca
  `Date`), porque é exatamente isso que chega ao cliente após a serialização JSON padrão do
  Express/Nest — tipar como `Date` seria uma mentira que só apareceria como bug em runtime.
- **Motivo:** `apps/mobile` é o primeiro consumidor real desses tipos (o pacote existia como
  placeholder inerte desde a FASE 1); duplicar os tipos à mão dentro de `apps/mobile` reintroduziria
  exatamente o risco de divergência que `packages/shared` existe para evitar.
- **Alternativas consideradas:** gerar os tipos automaticamente a partir do Swagger/OpenAPI já
  exposto por `apps/api` (`GET /docs`) (rejeitado por agora — adicionaria uma etapa de build/codegen
  nova ao monorepo; reavaliar se a manutenção manual começar a divergir com frequência, já que o
  contrato de API está razoavelmente estável neste ponto do roadmap).
- **Impacto futuro:** qualquer mudança de contrato em `apps/api` deve atualizar o arquivo
  correspondente aqui no mesmo PR — é responsabilidade de quem mexe na API, não deste pacote.

## 32. Stack do app: `expo-router` + `@tanstack/react-query` + `expo-secure-store`

- **Decisão:** navegação por arquivo (`expo-router`, já oficial/recomendado pelo Expo desde a SDK
  50+), cache/estado de servidor via `@tanstack/react-query` (evita reimplementar
  loading/erro/retry/cache à mão em cada tela), tokens de sessão em `expo-secure-store` (keychain/
  keystore nativo — nunca `AsyncStorage` puro, que não é criptografado).
- **Motivo:** todas as três são escolhas padrão de mercado para este tipo de app, bem documentadas,
  com dependências oficiais/maduras — nenhuma reinventa algo que o ecossistema Expo já resolve bem.
  `react-query` em particular evita duplicar em cada uma das ~15 telas a lógica de
  loading/erro/retry que já existe uma vez em `api-client.ts` + a config global de `query-client.ts`.
- **Alternativas consideradas:** React Navigation configurado manualmente em vez de `expo-router`
  (rejeitado — mais boilerplate para o mesmo resultado, e `expo-router` já é o caminho recomendado
  pela própria Expo); `useState`/`useEffect` manual para cada chamada de API em vez de `react-query`
  (rejeitado — é exatamente o padrão que gerou o problema documentado na decisão 34, abaixo, quando
  usado para algo que não é bootstrap único).
- **Impacto futuro:** nenhum específico — é a base sobre a qual toda tela nova deste app deve ser
  construída.

## 33. `expo-video`/`expo-audio`, não `expo-av` (que está em manutenção desde a SDK 52)

- **Decisão:** player de vídeo (aulas/lives) usa `expo-video` (`useVideoPlayer`/`VideoView`);
  captura de microfone (afinador) e reprodução de clique (metrônomo) usam `expo-audio`
  (`useAudioStream`/`useAudioPlayer`). `expo-av` não foi usado.
- **Motivo:** a própria Expo divide `expo-av` em `expo-video` + `expo-audio` desde a SDK 52 e não
  recomenda `expo-av` para projetos novos. Escrever código novo contra uma API em manutenção seria
  dívida técnica already-known no dia em que foi escrita — mesmo raciocínio de "verificar
  compatibilidade antes de gerar código" (regra 35 do prompt-mestre) já aplicado a Node/Prisma nas
  decisões 4 e 7.
- **Alternativas consideradas:** `expo-av` (rejeitado pelo motivo acima); biblioteca de terceiros
  para áudio (ex. `react-native-track-player`) (rejeitado — adicionaria uma dependência nativa extra
  fora do ecossistema Expo gerenciado sem necessidade, já que `expo-audio`/`expo-video` cobrem tudo
  que este app precisa).
- **Impacto futuro:** nenhum esperado — são os pacotes atualmente recomendados; se a Expo os
  substituir de novo no futuro, a migração afeta só `use-lesson-player.ts`, `use-metronome.ts` e
  `use-tuner.ts` (a lógica de domínio em `packages/music-tools` não muda).

## 34. Ler o `.d.ts` instalado antes de escrever contra uma API nativa — achado real: `useAudioStream`

- **Decisão:** antes de escrever qualquer código contra `expo-video`/`expo-audio`, os arquivos
  `.d.ts` reais instalados em `node_modules` foram lidos diretamente (não só a memória/treinamento
  do modelo) para confirmar a assinatura exata de cada hook/classe.
- **Motivo:** essa verificação mudou o design do afinador para melhor: a suposição inicial era que
  seria necessário um workaround (gravar clipes curtos em `.wav` e decodificar o PCM manualmente,
  já que `expo-av` não expõe captura de áudio cru em tempo real). Ao ler `AudioStream.types.d.ts`,
  ficou claro que `expo-audio`'s `useAudioStream` já entrega **PCM real e contínuo do microfone**
  via callback `onBuffer` — o afinador não precisa de nenhum workaround, só passar o buffer direto
  para `detectPitch()`. Sem essa checagem, o app teria sido escrito com uma limitação inexistente.
- **Alternativas consideradas:** confiar na lembrança geral de como `expo-av`/APIs de áudio do Expo
  costumavam funcionar (rejeitado — teria produzido uma implementação pior, com uma limitação
  documentada que não é real nesta versão do SDK).
- **Impacto futuro:** nenhuma limitação de captura de áudio precisa ser documentada para o afinador
  (diferente do metrônomo — decisão 35). Reforça o hábito de verificar `node_modules/**/*.d.ts` ao
  integrar qualquer API nativa nova neste app.

## 35. Limitação aceita: precisão do clique do metrônomo depende do timer JS, não de um clock nativo

- **Decisão:** `use-metronome.ts` documenta explicitamente (comentário no topo do arquivo + aviso na
  tela) que, ao contrário do player web (Web Audio API com `AudioContext.currentTime`, um clock de
  alta precisão independente do timer — seção 11 do prompt-mestre), o Expo gerenciado não expõe um
  `AudioContext` real: o clique só pode soar no instante em que o `setTimeout` de fato dispara,
  sujeito ao jitter normal do event loop JS. O agendamento (`MetronomeEngine.tick()`) continua
  exato e testado; só a execução final do som herda a imprecisão da plataforma.
- **Motivo:** documentar um limite real da plataforma como limite aceito (não como bug) é o mesmo
  princípio já aplicado à granularidade do Loop A-B (~250ms na web, seção 10) e aos cents do
  afinador (±5, seção 12) — a alternativa de fingir que o problema não existe seria pior do que
  declará-lo.
- **Alternativas consideradas:** escrever um módulo nativo customizado (Kotlin/Swift) para expor um
  clock de áudio de alta precisão (rejeitado — sairia do Expo gerenciado, exigindo EAS
  Build/development build; overengineering para o estágio atual do produto, sem terceiro
  instrumento/professor pedindo essa precisão ainda); usar `expo-av`'s scheduling (rejeitado —
  mesma limitação de manutenção da decisão 33, e não resolveria o problema de qualquer forma, já que
  nenhuma API do Expo gerenciado expõe um `AudioContext` real).
- **Impacto futuro:** se a precisão se tornar um requisito real (ex. professores de bateria
  reclamando), a solução é migrar para um development build com um módulo de áudio nativo dedicado
  — mudança isolada em `use-metronome.ts`, sem tocar em `MetronomeEngine` (`packages/music-tools`).

## 36. `eslint-plugin-react-hooks` v7 revelou (e ajudou a corrigir) padrões reais no app

- **Decisão:** o `.eslintrc.cjs` raiz nunca precisou de suporte a JSX (nenhum app React existia até
  aqui) — `apps/mobile/.eslintrc.cjs` adiciona `ecmaFeatures.jsx` e `eslint-plugin-react-hooks` v7,
  que já inclui as regras mais novas de "prontidão para o React Compiler"
  (`react-hooks/refs`, `react-hooks/immutability`, `react-hooks/set-state-in-effect`). Duas delas
  pegaram bugs reais e foram corrigidas (escrita de ref durante o render em
  `use-lesson-player.ts`; ver commit). As outras duas ocorrências (mutação de `player.currentTime`
  do `expo-video` e `loadProfile()` no bootstrap de `auth-context.tsx`) são padrões corretos e
  documentados pela própria Expo/React — silenciadas com `eslint-disable-next-line` pontual e
  comentário explicando o motivo, não um disable geral da regra.
- **Motivo:** mesmo espírito da decisão 23 (o teste de smoke do `AppModule` encontrou o bug real de
  `PORT`) — ferramentas de verificação mais rigorosas que o estritamente necessário valem a pena
  quando pegam bugs de verdade, mesmo quando também produzem alguns falsos positivos que precisam
  de julgamento para triar.
- **Alternativas consideradas:** não adicionar `eslint-plugin-react-hooks` (rejeitado — deixaria de
  pegar a escrita de ref durante o render, um bug real); desabilitar a regra inteira em vez de
  silenciar linha a linha (rejeitado — perderia a cobertura da regra para código futuro que talvez
  cometa o mesmo erro de verdade).
- **Impacto futuro:** `apps/admin` (FASE 11, também React) deve seguir o mesmo padrão de override
  local de ESLint, não duplicar a configuração dentro do `.eslintrc.cjs` raiz.

## 37. Vulnerabilidade moderada em `uuid`/`xcode` (ferramenta de build do Expo) — aceita e monitorada

- **Decisão:** `npm audit` acusa uma vulnerabilidade moderada em `uuid` (`GHSA-w5hq-g745-h8pq`),
  puxada transitivamente por `xcode` → `@expo/config-plugins` → `@expo/cli`. Investigado (mesmo
  método da decisão 7): é dependência **só de build-time** (`xcode` manipula arquivos de projeto
  Xcode durante `expo prebuild`/`expo run:ios`), nunca executada em runtime do app nem exposta a
  input do usuário final. A única correção automática (`npm audit fix --force`) rebaixaria `expo`
  para `46.0.21` — uma versão de 15 SDKs atrás, quebrando toda a stack SDK 57 já instalada.
- **Motivo:** downgrade massivo para corrigir uma vulnerabilidade de baixo risco real (ferramenta de
  build local, não superfície de ataque em produção) seria uma troca claramente ruim — mesmo
  raciocínio da decisão 7 ("a versão mais nova disponível é a que está vulnerável; a correção não
  depende de qual versão 'mais atual' se escolhe").
- **Alternativas consideradas:** aplicar `npm audit fix --force` (rejeitado pelo motivo acima);
  ignorar o `npm audit` sem documentar (rejeitado — viola a regra 38 do prompt-mestre, que exige
  tratar vulnerabilidades identificadas, e "tratar" aqui significa avaliar e documentar a decisão,
  não necessariamente aplicar a correção automática quando ela é pior que o problema).
- **Impacto futuro:** reavaliar quando a Expo publicar uma versão de `@expo/config-plugins` que
  atualize `xcode`/`uuid` sem exigir downgrade do SDK.

## 38. Lives no app do aluno são somente leitura — gerenciar uma live é do painel administrativo

- **Decisão:** `liveSessionsApi` em `apps/mobile` só expõe `list`/`get`/`getPlaybackUrl`. Os
  endpoints `go-live`/`end`/`cancel`/CRUD (`apps/api`, FASE 9) não têm nenhuma tela neste app.
- **Motivo:** `docs/00-primeira-entrega.md` (seção 3) já descreve `apps/mobile` como "App do aluno"
  — gerenciar uma transmissão é ação de professor/admin, que pertence ao painel administrativo
  (`apps/admin`, FASE 11). Mesmo raciocínio de escopo já usado na decisão 26 (o player embutido
  também segue essa mesma divisão app-por-papel).
- **Alternativas consideradas:** expor as ações de gestão de live também no app mobile, escondidas
  atrás de uma checagem de papel (`roles.includes('teacher')`) (rejeitado — misturaria a experiência
  de "app do aluno" com fluxos de professor que fazem mais sentido numa tela maior/painel dedicado;
  a API já valida a permissão de qualquer forma, então nada real se perde ao não duplicar a ação
  aqui).
- **Impacto futuro:** quando `apps/admin` (FASE 11) for criado, ele consome exatamente os endpoints
  de gestão que este app deliberadamente não usa — nenhuma mudança de contrato de API necessária.

## 39. `apps/admin` (FASE 11): Next.js App Router, sem SSR autenticado

- **Decisão:** painel administrativo/professor construído em Next.js 16 (App Router) + React 19 +
  Tailwind v4, mas **inteiramente client-rendered** para tudo que depende de sessão — não há
  autenticação no servidor (`middleware.ts`/RSC com cookies), o `AuthProvider` roda no cliente e
  decide o redirecionamento via `useEffect`, igual ao padrão já usado em `apps/mobile`.
- **Motivo:** o backend (`apps/api`) já expõe uma API REST versionada com JWT de acesso curto +
  refresh rotativo (decisão 8) — não existe sessão baseada em cookie do lado do servidor Next.js
  para reaproveitar. Implementar SSR autenticado exigiria um mecanismo de sessão próprio do Next
  (cookies httpOnly geridos por Route Handlers) só para este painel, contradizendo a decisão 2
  ("backend único, clientes múltiplos" — a fonte de verdade de auth é sempre `apps/api`).
- **Alternativas consideradas:** SSR com cookies httpOnly geridos por Route Handlers do Next
  (rejeitado nesta fase — mais seguro, mas exigiria duplicar/adaptar o fluxo de refresh token só
  para este app; ver decisão 41 sobre a troca de segurança aceita). Migrar para uma sessão NextAuth
  (rejeitado — adicionaria uma segunda fonte de verdade de identidade, quando `apps/api` já é essa
  fonte).
- **Impacto futuro:** se o painel crescer para justificar SSR autenticado (ex.: SEO, listagens
  muito grandes), reavaliar via Route Handlers com cookies httpOnly — ver decisão 41.

## 40. Endpoints administrativos de usuários adicionados a `apps/api` durante a FASE 11

- **Decisão:** `UsersController`/`UsersService` ganharam `GET /users` (lista paginada, com
  filtro por `status`/`role`/`search`), `GET /users/:id`, `PATCH /users/:id/roles` e
  `PATCH /users/:id/status` — todos `@Roles('admin')`. `UsersService.toAdminView()` centraliza o
  shape de resposta, reaproveitado também por `GET /users/me`.
- **Motivo:** ao construir a tela de gestão de usuários do `apps/admin`, não havia nenhum endpoint
  de leitura/gestão de usuários além do `me` — gap real descoberto organicamente, mesmo padrão já
  seguido nas decisões 22/23/29 (corrigir a lacuna no momento em que ela bloqueia o app real, em vez
  de reprojetar `apps/api` inteiro adiantado).
- **Alternativas consideradas:** gerenciar papéis/status diretamente no banco via seed/script
  administrativo (rejeitado — não é operável no dia a dia por um admin real, contradiz o próprio
  propósito de um painel administrativo). Reaproveitar `PATCH /users/me` com um `userId` extra no
  corpo (rejeitado — misturaria o contrato de "auto-atualização" com o de "gestão de terceiros",
  exigindo checagem de permissão condicional dentro do mesmo endpoint).
- **Impacto futuro:** nenhum. `packages/shared` ganhou `ListUsersQuery`/`UpdateUserRolesRequest`/
  `UpdateUserStatusRequest` (`src/users.ts`) e os tipos de escrita do catálogo/planos que faltavam
  (`CreateXRequest`/`UpdateXRequest` em `catalog.ts`/`subscriptions.ts`), todos consumidos por
  `apps/admin`.

## 41. Tokens em `localStorage` no `apps/admin` — tradeoff de segurança documentado, não ignorado

- **Decisão:** `auth-storage.ts` do admin guarda `accessToken`/`refreshToken` em `localStorage`
  (síncrono, ao contrário do `expo-secure-store` assíncrono do mobile).
- **Motivo:** dado que este app é client-rendered sem sessão de servidor (decisão 39), a alternativa
  mais segura de verdade — cookie `httpOnly` setado por um Route Handler do Next — exigiria que
  **toda** chamada à API passasse por um proxy no próprio Next.js (para o cookie nunca ser lido por
  JS, ele também não pode ser anexado manualmente ao `Authorization` header de um `fetch` direto ao
  `apps/api`). Isso duplicaria a camada de rede inteira só para este painel. `localStorage` é
  vulnerável a XSS (um script malicioso injetado pode ler o token), mas o painel roda atrás de login
  obrigatório para um público restrito (professores/admins da própria plataforma), não usuários
  finais anônimos — risco aceito e documentado, não descoberto tarde.
- **Alternativas consideradas:** cookie `httpOnly` via proxy Next (rejeitado nesta fase pelo custo
  de implementação vs. o público restrito do painel — ver "Impacto futuro"); `sessionStorage`
  (rejeitado — perderia a sessão a cada fechamento de aba, pior UX para um painel usado o dia
  inteiro, sem reduzir a exposição a XSS, que é o risco real aqui).
- **Impacto futuro:** se o painel for exposto a um público maior/menos confiável, migrar para
  cookies `httpOnly` + proxy de API via Route Handlers.

## 42. ESLint com dois configs em `apps/admin` (flat config do Next 9 + legado 8 da raiz)

- **Decisão:** `apps/admin` mantém **dois** arquivos de config: `eslint.config.mjs` (flat config,
  gerado pelo `create-next-app`, roda via `cd apps/admin && npm run lint`, usa ESLint 9 + as regras
  específicas do Next) e `.eslintrc.cjs` (legado, `root: false`, mesmo padrão de
  `apps/mobile/.eslintrc.cjs` da decisão 33 — herdado pelo `npm run lint` da raiz do monorepo, que
  ainda roda em ESLint 8).
- **Motivo:** Next.js 16 exige ESLint 9 (flat config) para suas próprias regras (`eslint-config-
next`); a raiz do monorepo nunca migrou para ESLint 9 porque nenhum app antes de `apps/mobile`
  (FASE 10) precisava de suporte a JSX. Migrar a raiz inteira para ESLint 9 agora arriscaria quebrar
  o lint já funcionando de `apps/api`/`apps/mobile` sem necessidade real — mesmo raciocínio da
  decisão 5 ("tooling compartilhado, mas sem forçar upgrade sem motivo").
- **Alternativas consideradas:** migrar todo o monorepo para ESLint 9 agora (rejeitado — escopo
  maior que o necessário para a FASE 11, risco desnecessário para `apps/api`/`apps/mobile`);
  desativar o lint da raiz para `apps/admin` (rejeitado — perderia cobertura das regras
  compartilhadas, ex. `eslint-plugin-react-hooks` v7, que já pegou bugs reais nesta mesma fase — ver
  decisão 45).
- **Impacto futuro:** revisitar quando o monorepo inteiro migrar para ESLint 9 (provável quando
  `apps/api`/`apps/mobile` também precisarem de alguma regra só disponível em flat config).

## 43. `hls.js` para o player de preview web do admin

- **Decisão:** `HlsVideo` (`apps/admin/src/features/player/hls-video.tsx`) usa `hls.js` para tocar
  HLS em qualquer navegador; só faz `video.src = src` direto quando o navegador já suporta HLS
  nativamente (`canPlayType('application/vnd.apple.mpegurl')`, verdadeiro no Safari).
- **Motivo:** `docs/00-primeira-entrega.md` (seção 10) já previa "Player web (admin/preview) baseado
  em HLS.js/Video.js" — `<video>` nativo não decodifica HLS via MSE fora do Safari, e tanto o
  preview de aula (`GET /lessons/:id/playback`, decisão 25) quanto o de live (`GET
/live-sessions/:id/playback`, decisão 29/30) devolvem URLs HLS.
- **Alternativas consideradas:** Video.js (citado como alternativa no próprio prompt-mestre;
  rejeitado por trazer sua própria UI de player/CSS quando só o preview é necessário aqui — `hls.js`
  é só a camada MSE, reaproveitando o `<video>` nativo/estilizado com Tailwind).
- **Impacto futuro:** nenhum — mesmo componente é reaproveitado tanto na tela de aula quanto na de
  live.

## 44. Metrônomo/afinador do admin usam Web Audio API — precisão real, não JS-timer-limited

- **Decisão:** `use-metronome-web.ts`/`use-tuner-web.ts` (`apps/admin/src/features/`) usam
  `AudioContext` de verdade: o metrônomo agenda cada clique com `oscillator.start(tick.time)` no
  clock de alta precisão do `AudioContext`, e o afinador captura PCM real via
  `getUserMedia` + `ScriptProcessorNode`. Ambos consomem o mesmo `MetronomeEngine`/`detectPitch` de
  `packages/music-tools` que o mobile usa.
- **Motivo:** a decisão 35 documentou que o clique do metrônomo no mobile herda o jitter do timer JS
  porque o Expo gerenciado não expõe um `AudioContext` real — o browser expõe. Implementar a versão
  web com a mesma precisão que a arquitetura sempre permitiu (mas o mobile não podia entregar) é o
  "acabamento" natural dessa limitação já conhecida, sem custo extra: o motor puro já suportava
  lookahead scheduling desde a FASE 8 (decisão 27), só faltava um ambiente com clock de audio real
  para explorá-lo por completo.
- **Alternativas consideradas:** reaproveitar arquivos `.wav` como no mobile (rejeitado — um
  `OscillatorNode` gerado em runtime evita carregar/decodificar assets binários só para um beep
  curto, e o Web Audio API já suporta osciladores nativamente). `AudioWorkletNode` em vez de
  `ScriptProcessorNode` para o afinador (rejeitado nesta fase — `ScriptProcessorNode` está
  depreciado mas amplamente suportado e não exige um arquivo worklet separado; aceitável para uma
  ferramenta de preview de professor, não um produto de áudio profissional — documentado em
  comentário no próprio arquivo).
- **Impacto futuro:** migrar o afinador para `AudioWorkletNode` se `ScriptProcessorNode` for
  removido dos navegadores suportados.

## 45. Ajustar estado durante a renderização em vez de `useEffect` + `setState` (`apps/admin`)

- **Decisão:** telas que inicializam campos editáveis a partir de dados carregados via
  `@tanstack/react-query` (`usuarios/[id]`, `aulas/[id]`) usam o padrão "ajustar estado durante o
  render" (guardado por um `initializedFor === data.id`) em vez de `useEffect(() => setX(...), [data])`.
- **Motivo:** `eslint-plugin-react-hooks` v7 (já adotado desde a decisão 36) sinalizou
  `react-hooks/set-state-in-effect` nos dois arquivos — `setState` síncrono dentro de um efeito
  causa um re-render em cascata desnecessário. A correção recomendada pela própria documentação do
  React (e pelo lint) é calcular/ajustar o estado durante a renderização quando a atualização é uma
  simples sincronização de "dado chegou → inicializa o form", não um efeito colateral real sobre um
  sistema externo.
- **Alternativas consideradas:** manter o `useEffect` e silenciar a regra (rejeitado — mesmo
  raciocínio da decisão 36: a regra pegou um padrão real, não um falso positivo — silenciar
  esconderia a cascata de render em vez de removê-la). Resetar via `key` no componente (rejeitado —
  re-montaria a árvore inteira da tela a cada navegação de id, mais caro que a guarda condicional).
- **Impacto futuro:** aplicar o mesmo padrão em qualquer tela futura que precise inicializar estado
  editável a partir de uma query assíncrona.

## 46. Pasta de rotas do dashboard: `dashboard/`, não `(dashboard)/` — grupo de rotas não gera segmento de URL

- **Decisão:** as telas autenticadas do admin vivem em `apps/admin/src/app/dashboard/` (segmento
  real de URL: `/dashboard/cursos`, `/dashboard/aulas/[id]` etc.), não em
  `app/(dashboard)/` como escrito inicialmente.
- **Motivo:** bug real pego pelo próprio `next build` (a tabela de rotas do build mostrou
  `/cursos`, `/aulas/[id]` etc. sem o prefixo `/dashboard`) — em nome de pasta entre parênteses, o
  Next.js App Router trata como **grupo de rotas** (organização de arquivos/layouts compartilhados),
  que deliberadamente **não** vira segmento de URL. Como todo `Link`/`router.replace` do app já
  apontava para `/dashboard/...` (inclusive `app/page.tsx`, que redireciona para `/dashboard` após
  login), o grupo `(dashboard)/page.tsx` também colidia silenciosamente com `app/page.tsx` na
  mesma rota `/`. Corrigido renomeando a pasta (mesma estrutura de arquivos, sem outra mudança).
- **Alternativas consideradas:** manter `(dashboard)` e reescrever todos os `href`/`router.replace`
  para as URLs reais sem prefixo (rejeitado — perderia o prefixo `/dashboard` que separa
  visualmente/semanticamente a área autenticada da pública, sem ganho real).
- **Impacto futuro:** nenhum — mas reforça a lição já registrada na decisão 34 ("ler o `.d.ts`/
  comportamento real antes de assumir") — aqui o achado só apareceu porque a tabela de rotas do
  `next build` foi de fato lida e conferida, não só "build passou sem erro".

## 47. FASE 12 (Testes) tem três camadas distintas, com fronteiras de acesso diferentes de propósito

- **Decisão:** três suítes novas, cada uma vendo a API de um jeito diferente: (1)
  `apps/api/test/*.e2e-spec.ts` — bootstrap completo do `AppModule` em processo
  (`@nestjs/testing`), acesso direto ao `PrismaService`, contra um Postgres real; (2) `tests/e2e/`
  (raiz do monorepo) — só HTTP (`fetch` nativo) contra uma instância de `apps/api` já rodando, sem
  importar nada de `apps/api/src`; (3) os 57 testes unitários já existentes desde as FASES 3-9,
  inalterados. A cobertura "unit" da estratégia de testes (seção 14 do prompt-mestre) já estava
  substancialmente feita antes da FASE 12 (RBAC, visibilidade de catálogo, entitlement, gateways/
  providers fake, transições de status) — esta fase deliberadamente focou nas duas camadas que
  faltavam (integration/e2e), não em expandir a unitária, que já cobria as regras de negócio puras
  citadas na própria seção 14.
- **Motivo:** a seção 14 do prompt-mestre já pede exatamente essa separação (unit/integration/e2e);
  a diferença de acesso entre (1) e (2) é deliberada, não redundância — (1) testa a lógica de
  negócio com o mínimo de camadas no caminho (rápido, acesso direto ao banco para preparar cenários
  e verificar efeitos colaterais como no teste de idempotência de webhook), enquanto (2) garante que
  existe pelo menos uma suíte que não sabe nada da implementação interna, do mesmo jeito que
  `apps/admin`/`apps/mobile` também só enxergam a API pela fronteira HTTP pública — um bug na
  fronteira HTTP (serialização, envelope de resposta, prefixo de rota) só apareceria em (2), nunca
  em (1), que usa o app Nest em memória.
- **Alternativas consideradas:** uma única camada de integração cobrindo tudo (rejeitado — perderia
  o valor de ter uma suíte verdadeiramente "cega" à implementação, que é o que torna (2) diferente
  de só rodar (1) com mais casos); usar `testcontainers` para subir Postgres automaticamente
  (rejeitado nesta fase — exigiria Docker rodando no ambiente de CI/dev, e esta sandbox não tem
  Docker disponível para validar essa escolha; documentado como possível evolução futura, não como
  decisão tomada às cegas).
- **Impacto futuro:** se o CI ganhar Docker disponível (FASE 13), considerar `testcontainers` para
  automatizar o Postgres descartável de (1)/(2) em vez de exigir um `docker run` manual documentado
  no README.

## 48. `resetDatabase()` recusa truncar um banco cujo nome não termine em `_test`

- **Decisão:** `apps/api/test/utils/reset-database.ts` valida `DATABASE_URL` com uma regex antes de
  rodar `TRUNCATE ... CASCADE` — se o nome do banco não terminar em `_test`, lança um erro e não
  executa nada.
- **Motivo:** os testes de integração truncam **todas** as tabelas entre arquivos (`beforeEach`) —
  se alguém rodar `npm run test:integration` sem configurar `.env.test.local` (ou configurá-lo
  apontando por engano para o banco de desenvolvimento), o dano seria irreversível e silencioso
  (nenhum erro até o teste realmente truncar tudo). Uma guarda de nomenclatura barata (checar o nome
  do banco) transforma um acidente catastrófico em um erro claro e imediato na primeira chamada.
- **Alternativas consideradas:** confiar só na documentação/README para o desenvolvedor configurar
  certo (rejeitado — a mesma categoria de erro humano que motivou, por exemplo, a decisão 23 sobre
  `PORT` nunca convertido de string: proteção em código é mais confiável que instrução escrita);
  usar uma variável de ambiente dedicada tipo `ALLOW_TEST_DB_RESET=true` em vez de checar o nome
  (rejeitado — exigiria mais um passo de configuração manual, e ainda seria burlável por engano;
  checar o nome do banco em si é uma convenção mais dura de quebrar sem querer).
- **Impacto futuro:** nenhum — a regra é auto-contida no helper, não vaza para nenhum outro código.

## 49. `tests/e2e` vira workspace novo (`tests/*` no glob raiz), não um script solto

- **Decisão:** `tests/e2e/` ganhou `package.json`/`tsconfig.json` próprios e entrou no glob
  `workspaces` da raiz (`"tests/*"`, ao lado de `apps/*`/`packages/*`), com `shared` como
  dependência de workspace normal.
- **Motivo:** o teste E2E cross-app precisa dos tipos de `packages/shared` para ficar tipado contra
  o contrato real da API (mesmo raciocínio de todo app cliente do monorepo); tratá-lo como workspace
  member (em vez de, por exemplo, um script solto em `scripts/`) mantém consistência com o resto do
  monorepo — mesmo `tsconfig.base.json`, mesmo ESLint/Prettier raiz, mesma forma de rodar
  (`npm run test --workspace=tests/e2e`).
- **Alternativas consideradas:** colocar o teste E2E dentro de `apps/api/test/` também (rejeitado —
  misturaria as duas fronteiras de acesso diferentes da decisão 47 no mesmo diretório/tsconfig,
  tornando fácil importar `src/` por engano num teste que deveria ser cego à implementação).
- **Impacto futuro:** nenhum — a pasta já existia como placeholder desde a FASE 1
  (`tests/e2e/README.md`), só ganhou conteúdo real agora, conforme sempre planejado no roadmap.

## 50. Seed ganhou `videoProvider`/`videoRef` nas aulas de exemplo — gap real achado ao escrever o E2E

- **Decisão:** as duas aulas criadas por `apps/api/prisma/seed.ts` agora têm `videoProvider: 'fake'`
  e um `videoRef` próprio (`seed-aula-1`/`seed-aula-2`).
- **Motivo:** o próprio comentário do seed já dizia que o curso de exemplo existia para "exercitar
  catálogo e progresso fim a fim" — mas sem `videoRef`, `GET /lessons/:id/playback` sempre
  retornava 409 (`ConflictException`, "aula ainda não tem vídeo associado"), tornando o passo
  "reprodução" dos 8 fluxos (seção 14) impossível de exercitar contra os dados do seed. Achado real
  ao escrever `tests/e2e/src/full-lifecycle.spec.ts` (decisão 49) — mesma categoria de correção
  orgânica de gap já praticada em toda fase anterior (PORT, `gatewayCustomerId`, `stream_ref`
  único, endpoints administrativos de usuários da decisão 40).
- **Alternativas consideradas:** o teste E2E criar sua própria aula com vídeo via API antes de
  testar o passo 5 (rejeitado — exigiria privilégio de admin/professor, e o teste E2E já usa contas
  seedadas para o catálogo de propósito, ver decisão 49; ajustar o seed é mais simples e beneficia
  qualquer pessoa explorando a API manualmente, não só o teste).
- **Impacto futuro:** nenhum.

## 51. Testes de integração fazem `assert`/setup passando pelo `UsersService` real, não Prisma cru

- **Decisão:** `apps/api/test/utils/fixtures.ts` promove um usuário a admin/professor chamando
  `app.get(UsersService).setRoles(...)` (o mesmo código de produção que o endpoint
  `PATCH /users/:id/roles` da decisão 40 usa), não escrevendo direto na tabela `user_roles` via
  Prisma.
- **Motivo:** usar o serviço real para arranjar o cenário de teste (em vez de manipular o banco
  cru) garante que o teste continua válido se a lógica de `setRoles` mudar (ex. passar a exigir uma
  auditoria, ou a invalidar um cache) — o setup do teste segue o mesmo caminho de código que
  qualquer chamador real usaria, só pulando a camada HTTP (que não é o que este teste quer isolar,
  ao contrário do que ele testa de verdade: RBAC, visibilidade, entitlement).
- **Alternativas consideradas:** criar o usuário já com a role certa via `prisma.user.create` com
  `userRoles: { create: ... }` direto (rejeitado — mais rápido, mas duplica silenciosamente a regra
  de "como promover alguém", que já existe em `UsersService`; se a regra mudar, o teste continuaria
  passando com uma alegria falsa).
- **Impacto futuro:** nenhum — o padrão deve ser seguido por qualquer teste de integração futuro que
  precise de um usuário com papéis não-`student`.

## 52. Contexto de build dos Dockerfiles é a raiz do monorepo, não `apps/api`/`apps/admin`

- **Decisão:** `apps/api/Dockerfile` e `apps/admin/Dockerfile` esperam ser buildados com
  `context: ..` apontando para a **raiz do repo** (ver `infra/docker/docker-compose.yml`,
  `context: ../..`), não a pasta do próprio app.
- **Motivo:** ambos precisam enxergar além da própria pasta — `apps/api` precisa dos
  `package.json` de todos os workspaces para `npm ci` respeitar o lockfile único do monorepo
  (decisão 53); `apps/admin` precisa do **código-fonte** de `packages/shared`/`packages/music-tools`
  (consumidos como TS cru, `"main": "src/index.ts"`, sem `dist` próprio — decisão original da FASE
  8/10) para o build do Next conseguir transpilar essas dependências. Um contexto de build restrito
  a `apps/api/`/`apps/admin/` simplesmente não alcançaria esses arquivos.
- **Alternativas consideradas:** publicar `shared`/`music-tools` num registro npm interno e
  instalá-los como dependência normal (rejeitado — infraestrutura desproporcional ao tamanho do
  projeto nesta fase; o monorepo já resolve isso de graça via workspaces, bastando o contexto de
  build certo). Pré-compilar `shared`/`music-tools` para `dist/` antes do build de `apps/admin`
  (rejeitado — mudaria a decisão já tomada nas FASES 8/10 de consumi-los como fonte direta, só para
  acomodar o Docker; o contexto de build correto resolve sem essa mudança).
- **Impacto futuro:** qualquer novo Dockerfile de app cliente que consuma `packages/*` como fonte
  precisa do mesmo contexto de build (raiz do repo), não só do seu próprio diretório.

## 53. `npm ci` roda uma vez para o monorepo inteiro em cada imagem, depois `npm prune --omit=dev`

- **Decisão:** a etapa `deps` de cada Dockerfile copia o `package.json` de **todos** os workspaces
  (não só o que está sendo buildado) e roda um único `npm ci` na raiz; a etapa `runtime` só recebe o
  resultado de `npm prune --omit=dev` rodado depois do build.
- **Motivo:** `npm ci` valida que o `package-lock.json` corresponde exatamente ao conjunto de
  `package.json` presentes — tentar restringir a instalação a um workspace específico (`npm ci -w
apps/api`) é um caminho conhecido por ter comportamento inconsistente entre versões do npm em
  monorepos com lockfile único, e esta sandbox não tem Docker para testar qual comportamento a
  versão instalada teria. Instalar tudo uma vez (caminho garantido e documentado do npm) e podar
  depois é mais lento na etapa `build`, mas comprovadamente correto — e a etapa `runtime` final
  ainda fica enxuta, já que só recebe o `node_modules` **podado**, não o instalado por completo.
- **Alternativas consideradas:** `npm ci -w <app>` (rejeitado pelo motivo acima — risco não
  verificável nesta sandbox); um lockfile separado por app (rejeitado — contradiz a decisão 1
  original do monorepo, "um lockfile único evita builds `works on my machine` de versões
  divergentes").
- **Impacto futuro:** se o tempo de build se tornar um problema real, revisitar com acesso a um
  ambiente Docker de verdade para testar `npm ci -w` com segurança.

## 54. `output: 'standalone'` do Next exigiu um `.gitkeep` em `apps/admin/public/`

- **Decisão:** `apps/admin/next.config.ts` ganhou `output: 'standalone'`; `apps/admin/public/`
  ganhou um `.gitkeep`. Verificado de verdade (`npm run build` local): o `server.js` da saída
  standalone fica exatamente em `.next/standalone/apps/admin/server.js` — o caminho que
  `apps/admin/Dockerfile` já assumia (`COPY`/`CMD`), confirmando que a detecção automática da raiz
  do monorepo pelo Next preserva o prefixo `apps/admin/` como esperado.
- **Motivo:** a saída `standalone` do Next não inclui `public/`/`.next/static` automaticamente (por
  design da própria feature — precisam ser copiados manualmente no Dockerfile, o que
  `apps/admin/Dockerfile` já faz). Ao revisar isso, um problema separado apareceu: a pasta
  `apps/admin/public/` existe no disco desta sandbox (criada pelo scaffold do `create-next-app` na
  FASE 11), mas está **vazia** — Git não versiona diretórios vazios, então um `git clone` limpo não
  recriaria essa pasta, e o `COPY --from=build .../public ./apps/admin/public` do Dockerfile
  falharia (`COPY` exige que a origem exista). Um `.gitkeep` garante que a pasta sempre exista após
  um clone.
- **Alternativas consideradas:** tornar o `COPY` do `public/` condicional/best-effort no Dockerfile
  (rejeitado — `COPY` do Docker não tem um jeito nativo de "ignorar se não existir" sem recorrer a
  truques frágeis; garantir que a pasta sempre exista é mais simples e correto).
- **Impacto futuro:** nenhum — mas vale lembrar ao adicionar qualquer outra pasta que hoje só existe
  "por acaso" no disco de desenvolvimento.

## 55. `docker-compose.prod.yml` não tenta "remover" as portas publicadas de `api`/`admin` via merge

- **Decisão:** o overlay de produção (`infra/docker/docker-compose.prod.yml`) redefine segredos,
  `restart: unless-stopped` e adiciona o serviço `nginx`, mas **não** tenta zerar `ports:` de
  `api`/`admin` para escondê-los atrás do nginx.
- **Motivo:** o comportamento exato de merge de listas (`ports`) do Docker Compose ao combinar
  múltiplos arquivos (`-f a -f b`) varia conforme o campo e a versão do Compose, e esta sandbox não
  tem o binário `docker compose` para confirmar experimentalmente se `ports: []` no overlay
  realmente substitui a lista base ou é ignorado/mesclado. Documentar um comportamento não testado
  como se fosse garantido seria pior do que ser explícito sobre a limitação — ver
  `infra/docker/docker-compose.prod.yml` e `infra/docker/README.md` para a alternativa recomendada
  (remover `ports:` direto no arquivo base, ou fechar via firewall do host).
- **Alternativas consideradas:** confiar no merge e documentar como se funcionasse (rejeitado —
  arriscaria publicar `api`/`admin` sem querer numa deploy real, exatamente o tipo de erro "parece
  certo mas não foi testado" que este projeto tem evitado desde a decisão de sempre ler o
  comportamento real antes de assumir, decisão 34).
- **Impacto futuro:** revisitar com acesso a um ambiente Docker real para confirmar o comportamento
  de merge e, se favorável, simplificar o overlay.

## 56. `.github/workflows/ci.yml` criado mesmo sem remoto GitHub configurado nesta sandbox

- **Decisão:** o workflow de CI (lint/typecheck, testes unitários, testes de integração contra um
  Postgres de serviço do próprio GitHub Actions, build das duas imagens Docker) foi escrito e
  commitado mesmo este repositório não tendo um remote GitHub configurado nesta sandbox.
- **Motivo:** `docs/00-primeira-entrega.md` (seção 15) já pede explicitamente lint, testes e build
  de imagem a cada PR como parte do escopo da FASE 13 — o arquivo fica pronto e correto
  sintaticamente para o momento em que o repositório for de fato publicado no GitHub, em vez de
  adiar essa parte da fase só por não haver um remote agora. Os testes de integração usam o recurso
  nativo de "service containers" do GitHub Actions (Postgres como serviço do job, não Docker-in-
  Docker) — funciona independente de o runner ter o daemon Docker exposto ao workflow da forma como
  os `docker build` da imagem final precisam.
- **Alternativas consideradas:** não escrever CI nesta fase, deixando para quando houver um remote
  (rejeitado — a seção 15 já define isso como parte do escopo da própria FASE 13, não de uma fase
  futura; adiar sem necessidade real contradiz o próprio roadmap).
- **Impacto futuro:** **nenhuma parte deste workflow foi executada de verdade** — nem localmente
  (sem Docker/Actions runner nesta sandbox) nem num Actions real (sem remote). Antes de confiar
  nele, publique o repositório no GitHub e observe a primeira execução real do workflow, corrigindo
  qualquer detalhe de sintaxe/comportamento que só aparece rodando de fato.

## 57. Auditoria final (FASE 14): `setRoles`/`setStatus` não gravavam audit log — corrigido

- **Decisão:** `UsersService.setRoles`/`setStatus` (endpoints administrativos da decisão 40) agora
  recebem o usuário autenticado que executa a ação (`actor`) e o IP da requisição, e gravam um
  `AuditService.record(...)` com `action: 'user.roles_updated'`/`'user.status_updated'`,
  `entityId` do usuário afetado e `metadata: { before, after }` (papéis ou status antes/depois da
  mudança). Coberto por um novo `users.service.spec.ts` (2 testes).
- **Motivo:** `docs/00-primeira-entrega.md` (seção 13, "Estratégia de segurança") exige
  explicitamente "logs de auditoria para ações sensíveis". Ao auditar sistematicamente todo
  `grep -rl AuditService apps/api/src` nesta fase, só `auth.service.ts` (registro/login/logout-all/
  troca e redefinição de senha/confirmação de e-mail, desde a FASE 3) gravava qualquer coisa —
  escalonar/rebaixar o papel de um usuário (inclusive conceder `admin`) e bloquear/reativar uma
  conta, ambos adicionados na FASE 11 sem passar por este mesmo checklist, ficaram sem trilha de
  auditoria. Este é o achado de maior severidade real desta auditoria: são exatamente as duas ações
  administrativas com maior potencial de abuso/necessidade de investigação forense (quem promoveu
  quem a admin, e quando; quem bloqueou a conta de quem, e por quê).
- **Alternativas consideradas:** auditar também o CRUD de catálogo/planos/lives (instrumentos,
  cursos, módulos, aulas, materiais, planos de assinatura, sessões ao vivo) na mesma varredura
  (parcialmente rejeitado por proporcionalidade — são ações de conteúdo, não de controle de acesso
  ou dinheiro; o risco de abuso e a necessidade de trilha forense são ordens de grandeza menores que
  escalonar privilégio ou mover dinheiro/assinatura, que já são cobertos: assinaturas por
  `auth.service.ts`/webhooks de pagamento, que já eram auditados via o próprio registro de
  `payment_webhook_events`). **Gap remanescente documentado, não escondido:** o CRUD de catálogo/
  planos/lives continua sem `AuditService.record` explícito — fica registrado aqui como débito
  técnico conhecido, não descoberto tarde.
- **Impacto futuro:** se o volume de conteúdo gerenciado crescer a ponto de precisar de uma trilha
  de "quem editou o quê" (não só "quem pode editar", que o RBAC já garante), adicionar
  `AuditService.record` ao CRUD de catálogo/planos/lives seguindo exatamente o mesmo padrão desta
  decisão.

## 58. Auditoria final: `credentials: true` do CORS removido — não usado e incompatível com `origin: '*'`

- **Decisão:** `app.enableCors({...})` em `src/main.ts` não passa mais `credentials: true`.
- **Motivo:** nenhum cliente (`apps/admin`, `apps/mobile`) autentica via cookie — o JWT sempre vai
  no header `Authorization` (decisões 8/32/41), então não existe credencial de fato cruzando
  origem para o CORS proteger. Mantida, a opção só criava uma configuração inválida pela própria
  especificação de CORS quando `CORS_ORIGIN` não está setada (`.env.example` já documenta o default `*` para desenvolvimento): a
  especificação CORS proíbe `Access-Control-Allow-Credentials: true` junto de
  `Access-Control-Allow-Origin: *`. Não quebrava nada na prática (nenhum cliente atual envia
  `credentials: 'include'` em suas chamadas `fetch`), mas era uma configuração "errada que
  funciona por acidente" — exatamente o tipo de coisa que uma auditoria final deve pegar antes que
  alguém dependa dela sem saber.
- **Alternativas consideradas:** manter `credentials: true` e restringir `CORS_ORIGIN` para nunca
  aceitar `*` (rejeitado — mudaria o comportamento de desenvolvimento sem necessidade real, já que
  a opção em si não é usada por nenhum cliente; remover a opção não usada é a correção mínima e
  correta).
- **Impacto futuro:** se um cliente futuro precisar de autenticação por cookie (ex. um app que
  precise de SSR autenticado — ver decisão 39 sobre por que `apps/admin` não faz isso hoje),
  reavaliar `credentials: true` nesse momento, com uma lista explícita de origens (nunca `*`).

## 59. Auditoria final: checklist da seção 13 (segurança) revisado item a item, sem gaps novos

- **Decisão:** cada item da "Estratégia de segurança" (`docs/00-primeira-entrega.md`, seção 13) foi
  conferido contra o código de verdade, não só contra a memória de tê-lo implementado em fases
  anteriores: JWT + refresh rotativo (decisão 8, testado desde a FASE 12), RBAC em toda rota
  sensível (toda mutação administrativa grepada manualmente — nenhum `@Post`/`@Patch`/`@Delete`
  sensível ficou sem `@Roles`/`@Public` explícito), hash de senha forte (bcryptjs, 12 salt rounds),
  rate limiting (decisão 9 - em memória, não Redis, aceito e já documentado), CORS restrito por
  ambiente (decisão 58 acima), Helmet (`main.ts`), validação/sanitização de entrada
  (`ValidationPipe` global com `whitelist`/`forbidNonWhitelisted`), proteção contra SQL injection
  (Prisma parametrizado em toda parte — o único `$queryRaw` de produção é um `SELECT 1` sem
  interpolação, em `health.controller.ts`), autorização sempre revalidada no backend (nenhuma regra
  de negócio confiada a um payload do frontend), logs de auditoria (decisão 57 acima), verificação
  de assinatura em todo webhook (`payments`/`live-sessions`, ambos HMAC), sem dado de cartão
  armazenado (schema nunca teve um campo de cartão), sem stack trace exposto em produção
  (`resolveErrorBody` checa `NODE_ENV`, testado desde a FASE 3).
- **Motivo:** uma auditoria final que só relê a documentação já escrita, sem reconferir contra o
  código, corre o risco de confirmar decisões que ficaram desatualizadas silenciosamente (foi
  assim que o gap da decisão 57 apareceu — o código de `auth.service.ts` nunca mudou, mas
  `users.service.ts` cresceu sem seguir o mesmo padrão).
- **Alternativas consideradas:** nenhuma — este item documenta o processo da auditoria em si, não
  uma escolha de design.
- **Impacto futuro:** repetir esta varredura sempre que uma nova rota administrativa/sensível for
  adicionada, não só no fim de um ciclo de fases.

## 60. CI não disparou no primeiro push real: `on.push.branches` apontava para `main`, o repositório usa `master`

- **Decisão:** `.github/workflows/ci.yml` passou a disparar em `push` para `master` (era `main`).
- **Motivo:** a decisão 56 já registrava honestamente que o workflow nunca tinha sido executado de
  verdade (sem remote GitHub nesta sandbox até então). Assim que o repositório foi criado de fato
  (`gh repo create`) e o primeiro `git push` aconteceu, `gh run list` não mostrou nenhuma execução —
  o branch padrão deste repositório é `master` (nome herdado do branch já existente localmente
  desde a FASE 1), não `main` (o nome mais comum hoje em dia, usado sem verificar o branch real
  deste projeto especificamente). É exatamente o tipo de erro que só aparece rodando de verdade,
  não lendo o YAML - confirma o próprio aviso já deixado na decisão 56.
- **Alternativas consideradas:** renomear o branch local/remoto de `master` para `main` (rejeitado —
  mudaria o branch padrão de um repositório já criado e com histórico compartilhado, sem nenhum
  benefício real sobre simplesmente corrigir o workflow para apontar para o branch que já existe).
- **Impacto futuro:** nenhum — mas reforça, de novo, a lição da decisão 34/56: qualquer coisa que só
  se comporta "certo ou errado" quando executada de verdade (não lida/revisada) precisa ser
  executada de verdade assim que possível, e o resultado real corrigido, não assumido.

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
