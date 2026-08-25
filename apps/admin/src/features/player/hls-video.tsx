'use client';

import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

/**
 * Player web/preview (docs/00-primeira-entrega.md, secao 10: "Player web (admin/preview) baseado
 * em HLS.js/Video.js"). `<video>` nativo so suporta HLS diretamente no Safari; nos demais
 * navegadores usa MSE via hls.js.
 */
export function HlsVideo({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, [src]);

  return <video ref={videoRef} controls className={className} />;
}
