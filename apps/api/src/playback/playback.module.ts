import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { LessonsModule } from '../lessons/lessons.module';
import { VideoProviderModule } from '../video/video-provider.module';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';

@Module({
  imports: [LessonsModule, AccessControlModule, VideoProviderModule],
  controllers: [PlaybackController],
  providers: [PlaybackService],
})
export class PlaybackModule {}
