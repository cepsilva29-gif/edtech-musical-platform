# packages/music-tools

Motores de **metrônomo** e **afinador** (FASE 8), como estado/algoritmo puros — sem nenhuma
dependência de Web Audio API, `getUserMedia`, DOM ou React Native. Compartilhado entre `apps/admin`
(preview web) e `apps/mobile` (app do aluno), que ainda não existem no monorepo (roadmap: FASE 11 e
FASE 10) — este pacote entrega exatamente a parte que **não** depende de qual desses apps a estará
consumindo, conforme a separação já prevista na seção 11/12 do prompt-mestre ("motor abstraído...
desacoplado da renderização").

## Metrônomo (`src/metronome/`)

`MetronomeEngine` implementa a técnica de **lookahead scheduling**: não toca nenhum som — dado um
clock de áudio (ex. `AudioContext.currentTime`), `tick(scheduleUntil)` devolve os eventos que devem
soar antes desse instante, avançando um clock lógico interno. O chamador real roda um timer
frequente (~25ms) que só _decide quando checar_, nunca toca som no próprio callback do timer,
evitando o drift característico de `setInterval` puro. Faixa de bpm 40–240, compasso e subdivisão
configuráveis, acentuação do primeiro tempo.

```ts
import { MetronomeEngine } from 'music-tools';

const engine = new MetronomeEngine({
  bpm: 120,
  timeSignature: { beatsPerBar: 4 },
  subdivision: 1,
  accentFirstBeat: true,
  volume: 0.8,
});

engine.start(audioContext.currentTime);

function scheduler() {
  const ticks = engine.tick(audioContext.currentTime + 0.1); // agenda 100ms a frente
  for (const tick of ticks) {
    // agendar o som de fato usando a Web Audio API / engine nativa em `tick.time`
  }
}
setInterval(scheduler, 25);
```

## Afinador (`src/tuner/`)

- `detectPitch(buffer, sampleRate)` — detecção de pitch por autocorrelação (algoritmo **YIN**)
  sobre um `Float32Array` já capturado. Aplica gate de amplitude (RMS mínimo) e rejeita leituras
  ambíguas via score de confiança — retorna `null` em vez de um palpite ruim.
- `matchNearestNote(frequency, tuning?)` — nota mais próxima entre um conjunto de afinações-alvo
  (padrão: as 6 cordas do violão/guitarra) e o desvio em cents (`1200 * log2(f / f_alvo)`).
  Tolerância de "afinado": **±5 cents** (`TUNE_TOLERANCE_CENTS`).
- `TunerSmoother` — média móvel das últimas N leituras de cents, para a indicação visual não
  "piscar" entre leituras individuais ruidosas.

```ts
import { detectPitch, matchNearestNote, TunerSmoother } from 'music-tools';

const smoother = new TunerSmoother(5);

function onAudioFrame(buffer: Float32Array, sampleRate: number) {
  const pitch = detectPitch(buffer, sampleRate);
  if (!pitch) return; // sinal fraco ou ambiguo - nao atualiza a UI
  const match = matchNearestNote(pitch.frequency);
  const smoothedCents = smoother.push(match.cents);
  // renderizar `match.note` + `smoothedCents` + `match.inTune`
}
```

## O que fica para quando `apps/admin`/`apps/mobile` existirem

- Captura de áudio (`getUserMedia` na web, API nativa no mobile) e agendamento real via
  `AudioContext`/engine nativa — este pacote só recebe/devolve dados já capturados.
- UI (ponteiro do afinador, visual do metrônomo, presets salvos).
- Persistência de preset do usuário (não modelada no schema do backend — é preferência de UI local).

## Testes

```bash
npm test --workspace=music-tools
```

Cobertura: validação de estado do metrônomo, agendamento determinístico (bpm/subdivisão/acentuação/
continuidade entre chamadas de `tick()`), detecção de pitch sobre ondas senoidais sintéticas
(tolerância <1%), rejeição de silêncio/ruído/baixa confiança, cálculo de cents e tolerância de
afinação, e a média móvel do `TunerSmoother`.
