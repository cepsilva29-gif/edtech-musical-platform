export interface ResolvePlaybackUrlInput {
  videoProvider: string | null;
  videoRef: string;
}

export interface PlaybackUrlResult {
  url: string;
  expiresAt: Date;
}

/**
 * Abstracao de provedor de video/streaming (docs/00-primeira-entrega.md, secao 9;
 * docs/ARCHITECTURE.md, decisao 3): nenhum modulo de dominio deve depender de um SDK concreto
 * (Mux, AWS IVS, YouTube Live) diretamente, so desta interface. `lessons.video_ref` guarda apenas
 * a referencia externa; a URL de reprodução (idealmente HLS assinada, de curta duração) é
 * resolvida em tempo de request, depois que o acesso já foi validado pelo chamador
 * (`AccessControlService.assertEntitled`).
 *
 * Selecionada via env VIDEO_PROVIDER (ver VideoProviderModule). Nesta fase so existe
 * FakeVideoProvider (dev/simulacao) - adapters reais entram quando houver credenciais, sem
 * precisar mudar nenhum consumidor desta interface.
 */
export abstract class VideoProvider {
  abstract readonly name: string;

  abstract resolvePlaybackUrl(input: ResolvePlaybackUrlInput): Promise<PlaybackUrlResult>;
}
