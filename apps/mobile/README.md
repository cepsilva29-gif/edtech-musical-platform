# apps/mobile

App do aluno — React Native + Expo (SDK 57) + TypeScript, consumindo `apps/api` e
`packages/music-tools`. FASE 10 do roadmap.

**Status:** cobertura funcional completa do fluxo do aluno (auth, catálogo, player com progresso,
metrônomo, afinador, assinaturas, lives em modo leitura) — profundidade de MVP, sem polimento
visual (ver "O que este pass prioriza" abaixo).

## Como rodar

```bash
cd apps/mobile
cp .env.example .env          # ajuste EXPO_PUBLIC_API_URL se a API nao estiver em localhost:3000
npm install                   # (se ainda nao rodou na raiz do monorepo)
npm start                     # abre o Metro bundler / Expo Dev Tools
```

Aponte para um `apps/api` rodando (ver `apps/api/README.md`) com o seed aplicado — o seed cria um
aluno de teste (`aluno.dev@example.com` / `Dev@12345`) com assinatura `ACTIVE`, um curso publicado
e uma live agendada, suficientes para exercitar todas as telas.

> **URL da API em dispositivo/emulador:** `localhost` não funciona a partir de um emulador Android
> (use `http://10.0.2.2:3000/api/v1`) nem de um dispositivo físico (use o IP da máquina na rede
> local). Configure via `EXPO_PUBLIC_API_URL` no `.env` ou `expo.extra.apiUrl` em `app.json`.

## Arquitetura

```
app/                    Rotas (expo-router, file-based)
  _layout.tsx             providers (QueryClient, Auth) + Stack raiz
  index.tsx                 redireciona para (auth) ou (app) conforme o status de login
  (auth)/                 login, registro
  (app)/                   area autenticada (guard de auth no _layout.tsx)
    (tabs)/                  Catalogo, Ferramentas, Lives, Assinatura, Perfil
    instrumento/[id]         cursos de um instrumento
    curso/[id]               modulos/aulas + progresso do curso
    aula/[id]                 player + loop A-B + materiais
    ferramentas/              metronomo, afinador
    lives/[id]                 detalhe + playback de uma live
src/
  services/
    api-client.ts          fetch tipado, injeta Bearer token, renova via refresh token num 401
    auth-storage.ts         tokens no keychain/keystore (expo-secure-store)
    api/                     uma funcao por endpoint de apps/api, tipada com `shared`
  state/
    auth-context.tsx        AuthProvider/useAuth (bootstrap, login, registro, logout)
    query-client.ts          instancia do @tanstack/react-query
  features/
    player/                  useLessonPlayer (expo-video) + loop-a-b.ts (logica pura, testada)
    metronome/                useMetronome (music-tools + expo-audio)
    tuner/                     useTuner (music-tools + expo-audio, captura real do microfone)
  ui/components.tsx          primitivos de UI minimos (Screen, Card, Button, TextField...)
  types/assets.d.ts          declaracao de modulo para `*.wav` (expo-env.d.ts e gitignored)
```

`packages/shared` fornece todos os tipos de request/response (nenhum tipo duplicado à mão);
`packages/music-tools` fornece o motor puro do metrônomo/afinador — este app só faz a ponte com
hardware real (áudio, microfone) e UI.

## Autenticação e API client

- Login/registro devolvem `{ user, accessToken, refreshToken }` (decisão de `apps/api`); os tokens
  vão para `expo-secure-store` (nunca `AsyncStorage` puro).
- `apiRequest()` injeta `Authorization: Bearer <token>` automaticamente. Num `401`, tenta
  `POST /auth/refresh` **uma vez** e repete a chamada original; se o refresh também falhar, limpa
  os tokens e notifica o `AuthProvider` (a UI redireciona para o login) — mesmo padrão de rotação
  de refresh token de `apps/api` (decisão 8 de `docs/ARCHITECTURE.md`), do lado cliente.
- `@tanstack/react-query` cuida de cache/retry para leituras; erros 4xx (`ApiError.status < 500`)
  não são retentados automaticamente (são respostas de negócio, não falha de rede).

## Player, progresso e Loop A-B

`useLessonPlayer` (`src/features/player/`) usa `expo-video` (`useVideoPlayer`/`VideoView`, a API
atual recomendada pelo Expo — `expo-av` está em modo manutenção desde o SDK 52). A cada evento
`timeUpdate`:

- Reporta progresso (`PUT /lessons/:id/progress`) a cada ~10s de reprodução e uma última vez ao
  desmontar a tela — o backend já lida com monotonicidade/conclusão automática (decisão 19).
- Decide o Loop A-B (`loop-a-b.ts`, **lógica pura, com 100% de cobertura de teste**): inteiramente
  client-side, conforme a seção 10 do prompt-mestre — marca `pointA`/`pointB`, e ao cruzar `pointB`
  dá seek de volta para `pointA`. Precisão limitada pela granularidade do evento do player (mesma
  ressalva já documentada na FASE 7), aceito como limite conhecido.

## Metrônomo e afinador

Ambos usam o motor puro de `packages/music-tools`; este app só faz a ponte com hardware real:

- **Metrônomo** (`use-metronome.ts`): mesmo padrão de _lookahead scheduling_ da seção 11 do
  prompt-mestre — um timer JS (`setInterval` a cada 25ms) só decide **quando checar**
  `MetronomeEngine.tick()`, nunca toca som direto no callback do timer.
  ⚠️ **Limitação conhecida e documentada no código:** diferente do Web Audio API (que expõe
  `AudioContext.currentTime`, um clock de alta precisão independente do timer), o Expo gerenciado
  não tem um `AudioContext` real — o clique só pode soar no instante em que o `setTimeout` de fato
  dispara, sujeito ao jitter normal do event loop JS (tipicamente poucos ms). O agendamento em si
  (`tick()`) continua exato; só a execução final do som herda essa imprecisão da plataforma.
- **Afinador** (`use-tuner.ts`): usa `expo-audio`'s `useAudioStream` — captura **PCM real e
  contínua do microfone** (`onBuffer`, sem gravar arquivo/decodificar depois) e alimenta
  `detectPitch`/`matchNearestNote`/`TunerSmoother` diretamente. Sem limitação conhecida adicional
  além da precisão do próprio algoritmo YIN (já testada em `packages/music-tools`).

Sons de clique (`assets/sounds/click.wav`, `accent.wav`) foram sintetizados (tom curto com
envelope de decaimento exponencial) por um script local, não são gravações de terceiros.

## Assinaturas e lives

`(tabs)/assinatura.tsx` cobre o fluxo completo de aluno: listar planos, `checkout`, ver status
atual, cancelar. `(tabs)/lives.tsx`/`lives/[id].tsx` são **somente leitura** — criar/gerenciar uma
live (go-live/end/cancel) é ação de professor/admin e pertence ao painel administrativo
(`apps/admin`, FASE 11), não ao app do aluno (mesmo escopo já declarado em
`docs/00-primeira-entrega.md`, seção 3).

## Testes e verificação

```bash
npm test        # jest — so a logica pura (loop-a-b.ts), sem depender de um simulador/dispositivo
npx tsc --noEmit
```

**O que foi verificado nesta sandbox:** `tsc --noEmit` limpo, `eslint` limpo (incluindo as regras
experimentais de `eslint-plugin-react-hooks` v7 — ver decisão sobre isso em
`docs/ARCHITECTURE.md`), os 10 testes unitários de `loop-a-b.ts`, e um **export real do Metro
bundler** (`npx expo export --platform android`) que compilou as 1744+ dependências do app sem
erro, incluindo todas as telas e os assets `.wav`. **O que não foi possível verificar aqui:** rodar
o app de fato num emulador/dispositivo (sem Android SDK/Xcode/simulador disponíveis nesta
sandbox) — então nenhuma tela foi conferida visualmente, e o comportamento real de
áudio/microfone/vídeo em runtime (só os tipos/contratos das APIs nativas foram conferidos, lendo os
`.d.ts` instalados de `expo-video`/`expo-audio` diretamente antes de escrever o código). Rode
`npm run ios` / `npm run android` no seu ambiente para validar antes de seguir para a próxima fase.

## Variáveis de ambiente

Ver `.env.example`. Só `EXPO_PUBLIC_API_URL` é necessária (variáveis `EXPO_PUBLIC_*` ficam
embutidas no bundle JS, então nunca coloque segredos aqui — o app não guarda nenhum segredo além
dos tokens de sessão do próprio usuário, que ficam no keychain/keystore, não em env).
