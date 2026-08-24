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
