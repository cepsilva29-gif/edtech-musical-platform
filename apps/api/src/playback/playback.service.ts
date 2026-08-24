import { ConflictException, Injectable } from '@nestjs/common';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { LessonsService } from '../lessons/lessons.service';
import { VideoProvider } from '../video/video-provider.interface';

export interface PlaybackUrlResponse {
  lessonId: string;
  provider: string;
  url: string;
  expiresAt: Date;
}

@Injectable()
export class PlaybackService {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly accessControlService: AccessControlService,
    private readonly videoProvider: VideoProvider,
  ) {}

  async resolve(user: AuthenticatedUser, lessonId: string): Promise<PlaybackUrlResponse> {
    const lesson = await this.lessonsService.findOne(user, lessonId);
    await this.accessControlService.assertEntitled(
      user.id,
      this.lessonsService.canManage(user, lesson),
    );

    if (!lesson.videoRef) {
      throw new ConflictException('Esta aula ainda nao tem video associado.');
    }

    const result = await this.videoProvider.resolvePlaybackUrl({
      videoProvider: lesson.videoProvider,
      videoRef: lesson.videoRef,
    });

    return {
      lessonId,
      provider: this.videoProvider.name,
      url: result.url,
      expiresAt: result.expiresAt,
    };
  }
}
