import { Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import {
  PlaybackUrlResult,
  ResolvePlaybackUrlInput,
  VideoProvider,
} from './video-provider.interface';

/**
 * Provedor de video de desenvolvimento/simulacao: nao chama nenhuma API externa. Gera uma URL
 * "assinada" (HMAC) apontando para um host fictitio, com expiracao curta - a forma/contrato e a
 * mesma que um provedor real (Mux/AWS IVS) produziria, para que o consumidor (player web/mobile,
 * quando existir) nao precise saber a diferenca.
 */
export class FakeVideoProvider extends VideoProvider {
  readonly name = 'fake';
  private readonly logger = new Logger(FakeVideoProvider.name);

  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {
    super();
  }

  resolvePlaybackUrl(input: ResolvePlaybackUrlInput): Promise<PlaybackUrlResult> {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);
    const signature = createHmac('sha256', this.secret)
      .update(`${input.videoRef}:${expiresAtUnix}`)
      .digest('hex');

    const url = `https://fake-video.dev.local/hls/${encodeURIComponent(input.videoRef)}/master.m3u8?exp=${expiresAtUnix}&sig=${signature}`;

    this.logger.log(
      `[DEV VIDEO] URL de playback fake gerada para videoRef="${input.videoRef}" (expira em ${this.ttlSeconds}s).`,
    );

    return Promise.resolve({ url, expiresAt });
  }
}
