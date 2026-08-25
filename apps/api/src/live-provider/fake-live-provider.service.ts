import { Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import {
  CreateLiveStreamInput,
  CreateLiveStreamResult,
  EndLiveStreamInput,
  LiveProvider,
  NormalizedLiveWebhookEvent,
  RecordingPlaybackUrlResult,
  ResolveRecordingPlaybackUrlInput,
  SimulatedLiveWebhookCall,
} from './live-provider.interface';

/**
 * Provedor de live de desenvolvimento/simulacao: nao chama nenhuma API externa. Cria um stream
 * fake instantaneamente e, ao encerrar, enfileira o evento "recording.ready" que um provedor real
 * enviaria minutos depois via webhook, assim que terminasse de processar a gravacao.
 */
export class FakeLiveProvider extends LiveProvider {
  readonly name = 'fake';
  private readonly logger = new Logger(FakeLiveProvider.name);
  private readonly pending: NormalizedLiveWebhookEvent[] = [];

  constructor(
    private readonly secret: string,
    private readonly recordingUrlTtlSeconds: number,
  ) {
    super();
  }

  createLiveStream(input: CreateLiveStreamInput): Promise<CreateLiveStreamResult> {
    const streamRef = `fake_live_${randomUUID()}`;
    const streamKey = randomUUID().replace(/-/g, '');

    this.logger.log(
      `[DEV LIVE] stream fake ${streamRef} criado para a live "${input.title}" (${input.liveSessionId}).`,
    );

    return Promise.resolve({
      streamRef,
      playbackUrl: `https://fake-video.dev.local/live/${encodeURIComponent(streamRef)}/master.m3u8`,
      ingestUrl: 'rtmps://fake-ingest.dev.local/live',
      streamKey,
    });
  }

  endLiveStream(input: EndLiveStreamInput): Promise<void> {
    const recordingRef = `fake_rec_${randomUUID()}`;
    this.logger.log(
      `[DEV LIVE] live ${input.streamRef} encerrada - gravacao fake ${recordingRef} sera vinculada via webhook.`,
    );

    this.pending.push({
      eventId: randomUUID(),
      type: 'recording.ready',
      streamRef: input.streamRef,
      recordingRef,
    });

    return Promise.resolve();
  }

  resolveRecordingPlaybackUrl(
    input: ResolveRecordingPlaybackUrlInput,
  ): Promise<RecordingPlaybackUrlResult> {
    const expiresAt = new Date(Date.now() + this.recordingUrlTtlSeconds * 1000);
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);
    const signature = createHmac('sha256', this.secret)
      .update(`${input.recordingRef}:${expiresAtUnix}`)
      .digest('hex');

    const url = `https://fake-video.dev.local/vod/${encodeURIComponent(input.recordingRef)}/master.m3u8?exp=${expiresAtUnix}&sig=${signature}`;

    return Promise.resolve({ url, expiresAt });
  }

  verifySignature(rawBody: string, signature: string | undefined): boolean {
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    return signature === expected;
  }

  mapWebhookEvent(rawBody: string): NormalizedLiveWebhookEvent {
    return JSON.parse(rawBody) as NormalizedLiveWebhookEvent;
  }

  drainSimulatedEvents(): SimulatedLiveWebhookCall[] {
    const events = this.pending.splice(0, this.pending.length);
    return events.map((event) => {
      const rawBody = JSON.stringify(event);
      return {
        rawBody,
        signature: createHmac('sha256', this.secret).update(rawBody).digest('hex'),
      };
    });
  }
}
