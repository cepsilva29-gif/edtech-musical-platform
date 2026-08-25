# apps/admin

Painel administrativo/professor — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4,
consumindo `apps/api` e `packages/music-tools`. FASE 11 do roadmap.

**Status:** cobertura funcional completa do fluxo de gestão (usuários, catálogo, aulas com preview
de vídeo e materiais, planos de assinatura, lives com go-live/end/cancel, metrônomo e afinador) —
profundidade de MVP, sem polimento visual, mesmo espírito do `apps/mobile` (FASE 10).

## Como rodar

```bash
cd apps/admin
cp .env.example .env.local    # ajuste NEXT_PUBLIC_API_URL se a API nao estiver em localhost:3000
npm install                   # (se ainda nao rodou na raiz do monorepo)
npm run dev                   # http://localhost:3000 (ou a porta livre seguinte)
```

Aponte para um `apps/api` rodando (ver `apps/api/README.md`) com o seed aplicado — o seed cria
`admin.dev@example.com` / `Dev@12345` (papel `admin`, acessa todas as telas) e
`professor.dev@example.com` / `Dev@12345` (papel `teacher`, vê um subconjunto — ver "Acesso e
papéis" abaixo).

## Arquitetura

```
src/app/
  page.tsx                 redireciona para /dashboard ou /login conforme o status de login
  login/page.tsx            formulario de login
  dashboard/                area autenticada (guard de auth e nav no layout.tsx)
    layout.tsx                sidebar + guard de auth + guard de papel (admin/teacher)
    page.tsx                  home do dashboard
    usuarios/                 lista + detalhe (papeis, status da conta)
    instrumentos/              CRUD
    cursos/                    lista + detalhe (modulos/aulas aninhados)
    aulas/[id]/                 edicao + preview de video (HlsVideo) + materiais CRUD
    planos/                     CRUD de planos de assinatura
    lives/                      lista + detalhe (go-live/end/cancel + preview HlsVideo)
    ferramentas/
      metronomo/                 Web Audio API (packages/music-tools)
      afinador/                   Web Audio API + getUserMedia (packages/music-tools)
src/services/
  api-client.ts             fetch tipado, injeta Bearer token, renova via refresh token num 401
  auth-storage.ts            tokens em localStorage (ver "Autenticação" abaixo)
  api/                        uma funcao por endpoint de apps/api, tipada com `shared`
src/state/
  auth-context.tsx           AuthProvider/useAuth (bootstrap, login, logout)
  providers.tsx                instancia do @tanstack/react-query
src/features/
  player/hls-video.tsx        player HLS reaproveitado por aulas e lives
  metronome/use-metronome-web.ts
  tuner/use-tuner-web.ts
src/ui/components.tsx        primitivos de UI minimos (Card, Button, Input, Table...)
```

`packages/shared` fornece todos os tipos de request/response, incluindo os tipos de escrita
(`CreateXRequest`/`UpdateXRequest`) adicionados nesta fase para o CRUD administrativo — ver decisão
40 em `docs/ARCHITECTURE.md`.

**Nota sobre a estrutura de pastas:** `dashboard/` é um segmento de URL real, não um grupo de rotas
entre parênteses — ver decisão 46 em `docs/ARCHITECTURE.md` para o porquê (um bug real de rota foi
pego e corrigido durante esta fase).

## Autenticação

- Login devolve `{ user, accessToken, refreshToken }` (mesmo contrato de `apps/mobile`); os tokens
  vão para `localStorage` — **não** `httpOnly` cookie. Tradeoff de segurança documentado (decisão
  41 em `docs/ARCHITECTURE.md`): sem sessão de servidor Next.js (decisão 39), a alternativa mais
  segura exigiria proxyar toda chamada de API pelo próprio Next só para este painel; aceito dado o
  público restrito (professores/admins logados, não usuários finais anônimos).
- `apiRequest()` injeta `Authorization: Bearer <token>` automaticamente. Num `401`, tenta
  `POST /auth/refresh` **uma vez** e repete a chamada original; se falhar, limpa os tokens e
  redireciona para `/login` — mesmo padrão do `apps/mobile`.

## Acesso e papéis

`dashboard/layout.tsx` bloqueia o painel inteiro para quem não tem papel `admin` nem `teacher`
("Acesso restrito"). Dentro do painel, alguns itens de navegação (Instrumentos, Planos, Usuários)
só aparecem para `admin` — a API já valida a permissão de qualquer forma (RBAC via `@Roles()`,
decisão original de FASE 3), a UI só evita mostrar ações que resultariam em `403`.

## Player de vídeo (preview)

`HlsVideo` (`src/features/player/hls-video.tsx`) usa `hls.js` para tocar as URLs HLS assinadas
devolvidas por `GET /lessons/:id/playback` e `GET /live-sessions/:id/playback` — `<video>` nativo
só suporta HLS via MSE no Safari, conforme já previsto em `docs/00-primeira-entrega.md` (seção 10)
e detalhado na decisão 43. Usado tanto na tela de aula quanto na de live.

## Metrônomo e afinador

Mesmo motor puro de `packages/music-tools` usado por `apps/mobile`, mas com a implementação **de
maior precisão** que a arquitetura sempre permitiu — ver decisão 44:

- **Metrônomo** (`use-metronome-web.ts`): agenda cada clique com `oscillator.start(tick.time)` no
  clock de `AudioContext.currentTime` — precisão de amostra, sem depender do timing de um
  `setTimeout`/`setInterval` do JS (diferente do mobile, que não tem um `AudioContext` real — ver
  decisão 35).
- **Afinador** (`use-tuner-web.ts`): `getUserMedia` + `ScriptProcessorNode` alimentam
  `detectPitch`/`matchNearestNote`/`TunerSmoother` com PCM real do microfone. `ScriptProcessorNode`
  está formalmente depreciado em favor de `AudioWorkletNode`, mas aceito nesta fase por não exigir
  um arquivo worklet separado (ferramenta de preview de professor, não produto de áudio
  profissional).

## Testes e verificação

```bash
npx tsc --noEmit
npm run lint        # ESLint 9, flat config proprio do Next
npx next build       # build de producao real (Turbopack)
```

**O que foi verificado nesta sandbox:** `tsc --noEmit` limpo (tanto aqui quanto nos demais
workspaces do monorepo após esta fase), `eslint` limpo nos **dois** configs (o flat config do Next
via `npm run lint` local, e o legado da raiz via `npx eslint apps/admin/src` — ver decisão 42),
`prettier --check` limpo, e um **`next build` real** (Turbopack) que compilou as 13 rotas do app
sem erro — foi justamente esse build que revelou e permitiu corrigir o bug de rota da decisão 46.
`apps/api` também foi re-testado (57/57 testes) e re-buildado após as mudanças desta fase, sem
regressão. **O que não foi possível verificar aqui:** rodar o app de fato num navegador (sem acesso
a um browser real nesta sandbox) — então nenhuma tela foi conferida visualmente, e o comportamento
real de áudio (Web Audio API)/microfone (`getUserMedia`)/vídeo (`hls.js`) em runtime não foi
exercitado manualmente, só os contratos de tipo e a compilação. Rode `npm run dev` no seu ambiente
e abra `http://localhost:3000` para validar visualmente antes de seguir para a próxima fase.

## Variáveis de ambiente

Ver `.env.example`. Só `NEXT_PUBLIC_API_URL` é necessária (variáveis `NEXT_PUBLIC_*` ficam
embutidas no bundle JS, então nunca coloque segredos aqui).

## Docker — FASE 13

`Dockerfile` (nesta pasta) usa o output `standalone` do Next (`next.config.ts`) — ver
`infra/docker/README.md` para como rodar. Como `NEXT_PUBLIC_API_URL` fica embutida no bundle JS no
momento do build (não do start do container), o build da imagem precisa do build-arg
`NEXT_PUBLIC_API_URL` já apontando para a URL que o **navegador** do usuário alcança — não o
hostname interno do Docker (`api`) — ver `infra/docker/docker-compose.yml`.
