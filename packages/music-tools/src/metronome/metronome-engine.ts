export interface TimeSignature {
  /** Numero de tempos (beats) por compasso, ex. 4 em 4/4. */
  beatsPerBar: number;
}

export interface MetronomeState {
  /** Batidas por minuto. Faixa suportada: 40-240 (secao 11 do prompt-mestre). */
  bpm: number;
  timeSignature: TimeSignature;
  /** Subdivisoes por tempo: 1 = so o tempo, 2 = colcheias, 4 = semicolcheias etc. */
  subdivision: number;
  /** Acentua o primeiro tempo de cada compasso. */
  accentFirstBeat: boolean;
  /** 0-1. */
  volume: number;
}

export interface ScheduledTick {
  /** Instante (no clock de audio do chamador, ex. AudioContext.currentTime) em que o tick soa. */
  time: number;
  /** Indice do tempo dentro do compasso (0-based). */
  beatIndex: number;
  /** Indice da subdivisao dentro do tempo (0-based; 0 = cai exatamente no tempo). */
  subdivisionIndex: number;
  /** true quando subdivisionIndex === 0 (o tick cai em cima de um tempo, nao de uma subdivisao). */
  isBeat: boolean;
  /** true quando e o primeiro tempo do compasso e accentFirstBeat esta ativo. */
  isAccent: boolean;
}

const MIN_BPM = 40;
const MAX_BPM = 240;

function validateState(state: MetronomeState): void {
  if (!Number.isFinite(state.bpm) || state.bpm < MIN_BPM || state.bpm > MAX_BPM) {
    throw new RangeError(`bpm deve estar entre ${MIN_BPM} e ${MAX_BPM} (recebido ${state.bpm}).`);
  }
  if (!Number.isInteger(state.timeSignature.beatsPerBar) || state.timeSignature.beatsPerBar < 1) {
    throw new RangeError('timeSignature.beatsPerBar deve ser um inteiro >= 1.');
  }
  if (!Number.isInteger(state.subdivision) || state.subdivision < 1) {
    throw new RangeError('subdivision deve ser um inteiro >= 1.');
  }
  if (state.volume < 0 || state.volume > 1) {
    throw new RangeError('volume deve estar entre 0 e 1.');
  }
}

/**
 * Motor de metronomo com estado puro, desacoplado de qualquer API de audio (secao 11 do
 * prompt-mestre). Nao agenda nem toca nenhum som: `tick()` implementa "lookahead scheduling" -
 * dado ate quando o chamador quer agendar (`scheduleUntil`, no mesmo clock que `start()` recebeu,
 * ex. `AudioContext.currentTime`), devolve a lista de eventos que devem soar antes desse instante,
 * avancando o clock logico interno. O chamador real (Web Audio API no admin/preview, engine de
 * audio nativa no mobile) roda um timer frequente (~25ms) que so CHAMA `tick()` e agenda cada
 * evento retornado usando o clock de alta precisao da plataforma - o timer em si nunca toca som
 * diretamente, evitando o drift caracteristico de setInterval/timers puros.
 */
export class MetronomeEngine {
  private state: MetronomeState;
  private nextTickTime: number | null = null;
  private nextBeatIndex = 0;
  private nextSubdivisionIndex = 0;

  constructor(initialState: MetronomeState) {
    validateState(initialState);
    this.state = { ...initialState };
  }

  getState(): Readonly<MetronomeState> {
    return this.state;
  }

  updateState(patch: Partial<MetronomeState>): void {
    const next: MetronomeState = {
      ...this.state,
      ...patch,
      timeSignature: { ...this.state.timeSignature, ...patch.timeSignature },
    };
    validateState(next);
    this.state = next;
  }

  get isRunning(): boolean {
    return this.nextTickTime !== null;
  }

  /** Reinicia o clock logico, comecando no tempo de audio informado. */
  start(audioTime: number): void {
    this.nextTickTime = audioTime;
    this.nextBeatIndex = 0;
    this.nextSubdivisionIndex = 0;
  }

  stop(): void {
    this.nextTickTime = null;
  }

  tick(scheduleUntil: number): ScheduledTick[] {
    if (this.nextTickTime === null) {
      return [];
    }

    const secondsPerTick = 60 / this.state.bpm / this.state.subdivision;
    const scheduled: ScheduledTick[] = [];

    while (this.nextTickTime < scheduleUntil) {
      const isBeat = this.nextSubdivisionIndex === 0;
      const isAccent = isBeat && this.nextBeatIndex === 0 && this.state.accentFirstBeat;

      scheduled.push({
        time: this.nextTickTime,
        beatIndex: this.nextBeatIndex,
        subdivisionIndex: this.nextSubdivisionIndex,
        isBeat,
        isAccent,
      });

      this.nextTickTime += secondsPerTick;
      this.nextSubdivisionIndex += 1;
      if (this.nextSubdivisionIndex >= this.state.subdivision) {
        this.nextSubdivisionIndex = 0;
        this.nextBeatIndex = (this.nextBeatIndex + 1) % this.state.timeSignature.beatsPerBar;
      }
    }

    return scheduled;
  }
}
