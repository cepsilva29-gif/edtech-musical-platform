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
import { CreateLessonMaterialDto } from './dto/create-lesson-material.dto';
import { ListLessonMaterialsQueryDto } from './dto/list-lesson-materials-query.dto';
import { UpdateLessonMaterialDto } from './dto/update-lesson-material.dto';
import { LessonMaterialsService } from './lesson-materials.service';

@ApiTags('lesson-materials')
@ApiBearerAuth()
@Controller()
export class LessonMaterialsController {
  constructor(private readonly lessonMaterialsService: LessonMaterialsService) {}

  @Get('lessons/:lessonId/materials')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Query() query: ListLessonMaterialsQueryDto,
  ) {
    return this.lessonMaterialsService.list(user, lessonId, query);
  }

  @Roles('admin', 'teacher')
  @Post('lessons/:lessonId/materials')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateLessonMaterialDto,
  ) {
    return this.lessonMaterialsService.create(user, lessonId, dto);
  }

  @Get('lesson-materials/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lessonMaterialsService.findOne(user, id);
  }

  @Roles('admin', 'teacher')
  @Patch('lesson-materials/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLessonMaterialDto,
  ) {
    return this.lessonMaterialsService.update(user, id, dto);
  }

  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('lesson-materials/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lessonMaterialsService.remove(user, id);
  }
}
