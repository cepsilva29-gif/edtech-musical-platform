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
import { CourseModulesService } from './course-modules.service';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { ListCourseModulesQueryDto } from './dto/list-course-modules-query.dto';
import { UpdateCourseModuleDto } from './dto/update-course-module.dto';

@ApiTags('course-modules')
@ApiBearerAuth()
@Controller()
export class CourseModulesController {
  constructor(private readonly courseModulesService: CourseModulesService) {}

  @Get('courses/:courseId/modules')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Query() query: ListCourseModulesQueryDto,
  ) {
    return this.courseModulesService.list(user, courseId, query);
  }

  @Roles('admin', 'teacher')
  @Post('courses/:courseId/modules')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateCourseModuleDto,
  ) {
    return this.courseModulesService.create(user, courseId, dto);
  }

  @Get('course-modules/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.courseModulesService.findOne(user, id);
  }

  @Roles('admin', 'teacher')
  @Patch('course-modules/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseModuleDto,
  ) {
    return this.courseModulesService.update(user, id, dto);
  }

  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('course-modules/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.courseModulesService.remove(user, id);
  }
}
