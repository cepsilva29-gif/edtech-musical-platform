import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('lessons/:lessonId/progress')
  getLessonProgress(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.progressService.getLessonProgress(user, lessonId);
  }

  @HttpCode(HttpStatus.OK)
  @Put('lessons/:lessonId/progress')
  upsertLessonProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonProgressDto,
  ) {
    return this.progressService.upsertLessonProgress(user, lessonId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('lessons/:lessonId/progress/complete')
  completeLesson(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.progressService.completeLesson(user, lessonId);
  }

  @Get('courses/:courseId/progress')
  getCourseProgress(@CurrentUser() user: AuthenticatedUser, @Param('courseId') courseId: string) {
    return this.progressService.getCourseProgress(user, courseId);
  }
}
