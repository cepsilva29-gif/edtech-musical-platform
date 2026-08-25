import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { ListLiveSessionsQueryDto } from './dto/list-live-sessions-query.dto';
import { UpdateLiveSessionDto } from './dto/update-live-session.dto';
import { LiveSessionsService } from './live-sessions.service';

@ApiTags('live-sessions')
@ApiBearerAuth()
@Controller('live-sessions')
export class LiveSessionsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  @Get()
  list(@Query() query: ListLiveSessionsQueryDto) {
    return this.liveSessionsService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.liveSessionsService.findOne(id);
  }

  @Roles('admin', 'teacher')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLiveSessionDto) {
    return this.liveSessionsService.create(user, dto);
  }

  @Roles('admin', 'teacher')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLiveSessionDto,
  ) {
    return this.liveSessionsService.update(user, id, dto);
  }

  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.liveSessionsService.remove(user, id);
  }

  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.OK)
  @Post(':id/go-live')
  goLive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.liveSessionsService.goLive(user, id);
  }

  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.OK)
  @Post(':id/end')
  end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.liveSessionsService.endLive(user, id);
  }

  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.liveSessionsService.cancel(user, id);
  }

  @Get(':id/playback')
  playback(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.liveSessionsService.resolvePlayback(user, id);
  }

  /**
   * Webhook publico por provedor (mesmo padrao de POST /payments/webhook/:gateway). O
   * FakeLiveProvider nunca chama esta rota via HTTP - alimenta processRecordingWebhook
   * diretamente em processo (ver LiveSessionsService.drainSimulatedEvents).
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhook/:provider')
  async webhook(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Headers('x-webhook-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    await this.liveSessionsService.processRecordingWebhook(
      provider,
      JSON.stringify(body ?? {}),
      signature,
    );
    return { received: true };
  }
}
