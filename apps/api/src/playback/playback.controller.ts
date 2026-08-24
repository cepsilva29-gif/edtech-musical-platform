import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PlaybackService } from './playback.service';

@ApiTags('playback')
@ApiBearerAuth()
@Controller()
export class PlaybackController {
  constructor(private readonly playbackService: PlaybackService) {}

  @Get('lessons/:id/playback')
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.playbackService.resolve(user, id);
  }
}
