import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('modules/:moduleId/lessons')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleId') moduleId: string,
    @Query() query: ListLessonsQueryDto,
  ) {
    return this.lessonsService.list(user, moduleId, query);
  }

  @Roles('admin', 'teacher')
  @Post('modules/:moduleId/lessons')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(user, moduleId, dto);
  }

  @Get('lessons/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lessonsService.findOne(user, id);
  }

  @Roles('admin', 'teacher')
  @Patch('lessons/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(user, id, dto);
  }

  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('lessons/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lessonsService.remove(user, id);
  }
}
