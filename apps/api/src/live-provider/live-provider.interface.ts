export interface CreateLiveStreamInput {
  liveSessionId: string;
  title: string;
}

export interface CreateLiveStreamResult {
  streamRef: string;
  /** URL de reproducao do streaming ao vivo (tipicamente estavel durante toda a live). */
  playbackUrl: string;
  /** Para o software de transmissao do professor (ex. OBS). */
  ingestUrl: string;
  streamKey: string;
}

export interface EndLiveStreamInput {
  streamRef: string;
}

export interface ResolveRecordingPlaybackUrlInput {
  streamProvider: string | null;
  recordingRef: string;
}

export interface RecordingPlaybackUrlResult {
  url: string;
  expiresAt: Date;
}

export type NormalizedLiveWebhookEventType = 'recording.ready';

export interface NormalizedLiveWebhookEvent {
  eventId: string;
  type: NormalizedLiveWebhookEventType;
  streamRef: string;
  recordingRef: string;
}

export interface SimulatedLiveWebhookCall {
  rawBody: string;
  signature: string;
}

/**
 * Abstracao de provedor de transmissao ao vivo (docs/00-primeira-entrega.md, secao 9;
 * docs/ARCHITECTURE.md, decisao 3): nenhum modulo de dominio deve depender de um SDK concreto
 * (Mux, AWS IVS, YouTube Live) diretamente, so desta interface. `live_sessions.stream_ref` guarda
 * apenas a referencia externa; a gravacao pos-live e vinculada de forma assincrona via webhook do
 * provedor ("gravacao pos-live e vinculada via webhook do provedor - processamento assincrono").
 *
 * Selecionada via env LIVE_PROVIDER (ver LiveProviderModule). Nesta fase so existe
 * FakeLiveProvider (dev/simulacao) - adapters reais entram quando houver credenciais.
 */
export abstract class LiveProvider {
  abstract readonly name: string;

  abstract createLiveStream(input: CreateLiveStreamInput): Promise<CreateLiveStreamResult>;
  abstract endLiveStream(input: EndLiveStreamInput): Promise<void>;
  abstract resolveRecordingPlaybackUrl(
    input: ResolveRecordingPlaybackUrlInput,
  ): Promise<RecordingPlaybackUrlResult>;
  abstract verifySignature(rawBody: string, signature: string | undefined): boolean;
  abstract mapWebhookEvent(rawBody: string): NormalizedLiveWebhookEvent;

  /**
   * Somente gateways de simulacao (dev/test) implementam isto: drena e assina os eventos que um
   * provedor real enviaria de forma assincrona ao endpoint de webhook (tipicamente minutos depois
   * de `endLiveStream`, quando o processamento da gravacao termina).
   */
  drainSimulatedEvents?(): SimulatedLiveWebhookCall[];
}
