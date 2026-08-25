import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FakeLiveProvider } from './fake-live-provider.service';
import { LiveProvider } from './live-provider.interface';

@Module({
  providers: [
    {
      provide: LiveProvider,
      useFactory: (config: ConfigService): LiveProvider => {
        const provider = config.get<string>('LIVE_PROVIDER', 'fake');
        if (provider !== 'fake') {
          throw new Error(
            `LIVE_PROVIDER="${provider}" nao tem implementacao ainda. Somente "fake" (dev) ` +
              'esta disponivel nesta fase - ver docs/ARCHITECTURE.md.',
          );
        }
        const secret = config.get<string>('FAKE_LIVE_PROVIDER_SECRET', 'dev-fake-live-secret');
        const ttlSeconds = config.get<number>('LIVE_RECORDING_URL_TTL_SECONDS', 600);
        return new FakeLiveProvider(secret, ttlSeconds);
      },
      inject: [ConfigService],
    },
  ],
  exports: [LiveProvider],
})
export class LiveProviderModule {}
