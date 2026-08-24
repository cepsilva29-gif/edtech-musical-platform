import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FakeVideoProvider } from './fake-video-provider.service';
import { VideoProvider } from './video-provider.interface';

@Module({
  providers: [
    {
      provide: VideoProvider,
      useFactory: (config: ConfigService): VideoProvider => {
        const provider = config.get<string>('VIDEO_PROVIDER', 'fake');
        if (provider !== 'fake') {
          throw new Error(
            `VIDEO_PROVIDER="${provider}" nao tem implementacao ainda. Somente "fake" (dev) ` +
              'esta disponivel nesta fase - ver docs/ARCHITECTURE.md.',
          );
        }
        const secret = config.get<string>('FAKE_VIDEO_PROVIDER_SECRET', 'dev-fake-video-secret');
        const ttlSeconds = config.get<number>('VIDEO_PLAYBACK_URL_TTL_SECONDS', 600);
        return new FakeVideoProvider(secret, ttlSeconds);
      },
      inject: [ConfigService],
    },
  ],
  exports: [VideoProvider],
})
export class VideoProviderModule {}
