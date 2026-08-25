import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { LiveProviderModule } from '../live-provider/live-provider.module';
import { LiveSessionsController } from './live-sessions.controller';
import { LiveSessionsService } from './live-sessions.service';

@Module({
  imports: [InstrumentsModule, AccessControlModule, LiveProviderModule],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService],
})
export class LiveSessionsModule {}
